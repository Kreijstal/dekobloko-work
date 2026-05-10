#include <math.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include <lv2/atom/atom.h>
#include <lv2/atom/util.h>
#include <lv2/core/lv2.h>
#include <lv2/midi/midi.h>
#include <lv2/urid/urid.h>

#define FUNORB_NATIVE_URI "https://funorb.local/lv2/funorb-native"
#define MAX_VOICES 256

enum { PORT_MIDI_IN = 0, PORT_AUDIO_L = 1, PORT_AUDIO_R = 2 };

typedef struct {
    int rate;
    int loop_start;
    int loop_end;
    int pingpong;
    int length;
    int8_t* pcm;
} Sample;

typedef struct {
    int present;
    int a;
    int b;
    int c;
    int h;
    int i;
    int j;
    int k;
    int d_len;
    int8_t* d;
    int e_len;
    int8_t* e;
} Envelope;

typedef struct {
    int sample;
    int root_key;
    int tune;
    int volume;
    int pan;
    int exclusive_class;
    int pitch_base;
    Envelope env;
} Region;

typedef struct {
    int id;
    Region regions[128];
} Patch;

typedef struct {
    int active;
    int released;
    int channel;
    int note;
    int exclusive_class;
    const Sample* sample;
    int pos_q8;
    int step_q8;
    int direction;
    float base_gain;
    float pan;
    float release_gain;
    const Region* region;
    int pitch_delta;
    int pitch_slide;
    int pitch_slide_target;
    int age;
    int vib_phase;
    int amp_time;
    int amp_index;
    int rel_time;
    int rel_index;
    int rel_started;
    int decay_time;
    int control_countdown;
    int gain_l_q16;
    int gain_r_q16;
    int gain_l_step_q16;
    int gain_r_step_q16;
    int ramp_remaining;
    int retrigger_phase_q20;
} Voice;

typedef struct {
    const LV2_Atom_Sequence* midi_in;
    float* audio_l;
    float* audio_r;
    LV2_URID midi_event;
    double sample_rate;
    int sample_count;
    Sample* samples;
    int patch_count;
    Patch* patches;
    int bank_msb[16];
    int bank_lsb[16];
    int program[16];
    int volume[16];
    int expression[16];
    int pan[16];
    int modulation[16];
    int start_pos[16];
    int retrigger_param[16];
    int retrigger_rate[16];
    int pitch_bend[16];
    int pitch_range[16];
    int sustain[16];
    int retrigger[16];
    Voice voices[MAX_VOICES];
} FunOrbNative;

static uint16_t rd16(const uint8_t** p) {
    uint16_t v = (uint16_t)(*p)[0] | ((uint16_t)(*p)[1] << 8);
    *p += 2;
    return v;
}

static int16_t rds16(const uint8_t** p) {
    return (int16_t)rd16(p);
}

static uint32_t rd32(const uint8_t** p) {
    uint32_t v = (uint32_t)(*p)[0] | ((uint32_t)(*p)[1] << 8) | ((uint32_t)(*p)[2] << 16) | ((uint32_t)(*p)[3] << 24);
    *p += 4;
    return v;
}

static int32_t rds32(const uint8_t** p) {
    return (int32_t)rd32(p);
}

static void read_envelope(const uint8_t** p, Envelope* env) {
    memset(env, 0, sizeof(*env));
    env->present = *(*p)++;
    if (!env->present) return;
    env->a = rds32(p);
    env->b = rds32(p);
    env->c = rds32(p);
    env->h = rds32(p);
    env->i = rds32(p);
    env->j = rds32(p);
    env->k = rds32(p);
    env->d_len = rd16(p);
    if (env->d_len > 0) {
        env->d = (int8_t*)malloc((size_t)env->d_len);
        memcpy(env->d, *p, (size_t)env->d_len);
        *p += env->d_len;
    }
    env->e_len = rd16(p);
    if (env->e_len > 0) {
        env->e = (int8_t*)malloc((size_t)env->e_len);
        memcpy(env->e, *p, (size_t)env->e_len);
        *p += env->e_len;
    }
}

static char* join_path(const char* base, const char* name) {
    size_t base_len = strlen(base);
    size_t name_len = strlen(name);
    int slash = base_len > 0 && base[base_len - 1] != '/';
    char* out = (char*)calloc(base_len + name_len + (slash ? 2 : 1), 1);
    memcpy(out, base, base_len);
    if (slash) out[base_len++] = '/';
    memcpy(out + base_len, name, name_len);
    return out;
}

static int load_bank(FunOrbNative* self, const char* path) {
    FILE* f = fopen(path, "rb");
    if (!f) return 0;
    fseek(f, 0, SEEK_END);
    long size = ftell(f);
    fseek(f, 0, SEEK_SET);
    uint8_t* data = (uint8_t*)malloc((size_t)size);
    if (!data || fread(data, 1, (size_t)size, f) != (size_t)size) {
        fclose(f);
        free(data);
        return 0;
    }
    fclose(f);
    const uint8_t* p = data;
    if (memcmp(p, "FOBK", 4)) {
        free(data);
        return 0;
    }
    p += 4;
    int version = (int)rd32(&p);
    self->sample_count = (int)rd32(&p);
    self->samples = (Sample*)calloc((size_t)self->sample_count, sizeof(Sample));
    for (int i = 0; i < self->sample_count; i++) {
        Sample* s = &self->samples[i];
        s->rate = (int)rd32(&p);
        s->loop_start = (int)rd32(&p);
        s->loop_end = (int)rd32(&p);
        s->pingpong = *p++;
        s->length = (int)rd32(&p);
        s->pcm = (int8_t*)malloc((size_t)s->length);
        memcpy(s->pcm, p, (size_t)s->length);
        p += s->length;
    }
    self->patch_count = (int)rd32(&p);
    self->patches = (Patch*)calloc((size_t)self->patch_count, sizeof(Patch));
    for (int i = 0; i < self->patch_count; i++) {
        Patch* patch = &self->patches[i];
        patch->id = rd16(&p);
        for (int n = 0; n < 128; n++) {
            Region* r = &patch->regions[n];
            r->sample = (int)(int16_t)rd16(&p);
            r->root_key = *p++;
            r->tune = rds16(&p);
            r->volume = *p++;
            r->pan = *p++;
            r->exclusive_class = *p++;
            r->pitch_base = r->root_key << 8;
            if (version >= 2) {
                int pitch = rd16(&p);
                r->pitch_base = (n << 8) - (pitch & 0x7FFF);
                read_envelope(&p, &r->env);
            }
        }
    }
    free(data);
    return 1;
}

static const Patch* find_patch(FunOrbNative* self, int id) {
    for (int i = 0; i < self->patch_count; i++) {
        if (self->patches[i].id == id) return &self->patches[i];
    }
    return NULL;
}

static int envelope_at(const int8_t* env, int len, int index, int time) {
    if (!env || len < 2) return 128;
    int value = env[index + 1];
    if (index < len - 2) {
        int t0 = ((int)env[index] & 0xFF) << 8;
        int t1 = ((int)env[index + 2] & 0xFF) << 8;
        int v1 = env[index + 3];
        if (t1 != t0) {
            value += (time - t0) * (v1 - value) / (t1 - t0);
        }
    }
    return value;
}

static void advance_envelope_index(const int8_t* env, int len, int* index, int time) {
    while (*index < len - 2 && time > (((int)env[*index + 2] & 0xFF) << 8)) {
        *index += 2;
    }
}

static int voice_step_q8(FunOrbNative* self, int ch, const Voice* v) {
    int pitch_units = v->region->pitch_base + ((v->pitch_slide * v->pitch_slide_target) >> 12);
    int bend_units = (self->pitch_bend[ch] - 8192) * (self->pitch_range[ch] * 256 / 100) / 8192;
    pitch_units += bend_units;
    const Envelope* env = &v->region->env;
    if (env->present && env->k > 0 && (env->c > 0 || self->modulation[ch] > 0)) {
        int depth = (env->c << 2) + (self->modulation[ch] >> 7);
        int ramp = env->h << 1;
        if (v->age < ramp && ramp > 0) {
            depth = depth * v->age / ramp;
        }
        pitch_units += (int)(sin((double)(v->vib_phase & 0x1FF) * 0.01227184630308513) * (double)depth);
    }
    int step = (int)(0.5 + ((double)v->sample->rate * 256.0 / self->sample_rate) * pow(2.0, (double)pitch_units / 3072.0));
    return step > 0 ? step : 1;
}

static void voice_gains(FunOrbNative* self, Voice* v, float* left, float* right) {
    int ch = v->channel;
    float volume = (float)self->volume[ch] / 16383.0f;
    float expression = (float)self->expression[ch] / 16383.0f;
    float channel_gain = volume * volume * expression;
    const Envelope* env = &v->region->env;
    if (env->present) {
        if (env->a > 0) {
            channel_gain *= (float)pow(0.5, (double)env->a * (1.953125E-5 * (double)v->decay_time));
        }
        if (env->d_len > 0) {
            int env_gain = envelope_at(env->d, env->d_len, v->amp_index, v->amp_time);
            channel_gain *= (float)env_gain / 128.0f;
        }
        if (v->rel_started && env->e_len > 0) {
            int rel_gain = envelope_at(env->e, env->e_len, v->rel_index, v->rel_time);
            channel_gain *= (float)rel_gain / 128.0f;
        }
    }
    float pan = ((float)self->pan[ch] + v->pan) * 0.5f;
    if (pan < 0.0f) pan = 0.0f;
    if (pan > 16383.0f) pan = 16383.0f;
    float l = sqrtf((16383.0f - pan) / 16384.0f);
    float r = sqrtf(pan / 16384.0f);
    float gain = v->base_gain * channel_gain * v->release_gain;
    *left = gain * l;
    *right = gain * r;
}

static void voice_gains_q6(FunOrbNative* self, Voice* v, int* left, int* right) {
    float l;
    float r;
    voice_gains(self, v, &l, &r);
    *left = (int)(l * 4096.0f + 0.5f);
    *right = (int)(r * 4096.0f + 0.5f);
}

static int control_period(FunOrbNative* self);
static void set_gain_ramp(FunOrbNative* self, Voice* v, int frames);

static void note_off(FunOrbNative* self, int ch, int note) {
    for (int i = 0; i < MAX_VOICES; i++) {
        if (self->voices[i].active && self->voices[i].channel == ch && self->voices[i].note == note) {
            if (self->sustain[ch]) {
                self->voices[i].released = 1;
            } else {
                self->voices[i].released = 1;
                self->voices[i].rel_started = 1;
                self->voices[i].rel_time = 0;
                self->voices[i].rel_index = 0;
                self->voices[i].release_gain = fminf(self->voices[i].release_gain, 0.999f);
            }
        }
    }
}

static void all_notes_off(FunOrbNative* self, int ch) {
    for (int i = 0; i < MAX_VOICES; i++) {
        if (self->voices[i].active && self->voices[i].channel == ch) {
            self->voices[i].released = 1;
            self->voices[i].rel_started = 1;
            self->voices[i].rel_time = 0;
            self->voices[i].rel_index = 0;
            self->voices[i].release_gain = fminf(self->voices[i].release_gain, 0.999f);
        }
    }
}

static void sustain_off(FunOrbNative* self, int ch) {
    self->sustain[ch] = 0;
    for (int i = 0; i < MAX_VOICES; i++) {
        if (self->voices[i].active && self->voices[i].channel == ch && self->voices[i].released) {
            self->voices[i].rel_started = 1;
            self->voices[i].rel_time = 0;
            self->voices[i].rel_index = 0;
            self->voices[i].release_gain = fminf(self->voices[i].release_gain, 0.999f);
        }
    }
}

static void note_on(FunOrbNative* self, int ch, int note, int vel) {
    int patch_id = (self->bank_msb[ch] == 128 || ch == 9) ? 128 : self->program[ch];
    const Patch* patch = find_patch(self, patch_id);
    if (!patch) return;
    const Region* r = &patch->regions[note & 127];
    if (r->sample < 0 || r->sample >= self->sample_count) return;
    const Sample* sample = &self->samples[r->sample];
    if (r->exclusive_class > 0) {
        for (int i = 0; i < MAX_VOICES; i++) {
            if (self->voices[i].active && self->voices[i].exclusive_class == r->exclusive_class) {
                self->voices[i].active = 0;
            }
        }
    }
    Voice* v = NULL;
    for (int i = 0; i < MAX_VOICES; i++) {
        if (!self->voices[i].active) {
            v = &self->voices[i];
            break;
        }
    }
    if (!v) v = &self->voices[0];
    float amp = (float)(vel / 127.0 * r->volume / 128.0);
    v->active = 1;
    v->released = 0;
    v->channel = ch;
    v->note = note & 127;
    v->exclusive_class = r->exclusive_class;
    v->sample = sample;
    v->region = r;
    v->pos_q8 = 0;
    v->direction = 1;
    if (self->start_pos[ch] > 0) {
        double pos;
        if (sample->pingpong && sample->loop_end > sample->loop_start) {
            double span = (double)(sample->length + sample->length - sample->loop_start);
            pos = (double)self->start_pos[ch] * span / 16384.0;
            if (pos >= sample->length) {
                v->direction = -1;
                pos = (double)(sample->length + sample->length) - 1.0 - pos;
            }
        } else {
            pos = (double)self->start_pos[ch] * (double)sample->length / 16384.0;
        }
        if (pos >= 0.0 && pos < sample->length) {
            v->pos_q8 = (int)(pos * 256.0 + 0.5);
        }
    }
    v->pitch_delta = 4096;
    v->pitch_slide = 0;
    v->pitch_slide_target = 0;
    v->age = 0;
    v->vib_phase = 0;
    v->amp_time = 0;
    v->amp_index = 0;
    v->rel_time = 0;
    v->rel_index = 0;
    v->rel_started = 0;
    v->decay_time = 0;
    v->step_q8 = voice_step_q8(self, ch, v);
    v->control_countdown = control_period(self);
    v->gain_l_q16 = 0;
    v->gain_r_q16 = 0;
    v->gain_l_step_q16 = 0;
    v->gain_r_step_q16 = 0;
    v->ramp_remaining = 0;
    v->retrigger_phase_q20 = 0;
    v->base_gain = amp;
    v->pan = (float)r->pan * 128.0f;
    v->release_gain = 1.0f;
    set_gain_ramp(self, v, 1);
}

static void reset_channel(FunOrbNative* self, int ch) {
    self->bank_msb[ch] = ch == 9 ? 128 : 0;
    self->bank_lsb[ch] = 0;
    self->program[ch] = 0;
    self->volume[ch] = 12800;
    self->expression[ch] = 16383;
    self->pan[ch] = 8192;
    self->modulation[ch] = 0;
    self->start_pos[ch] = 0;
    self->retrigger_param[ch] = 8192;
    self->retrigger_rate[ch] = (int)(0.5 + 2097152.0 * pow(2.0, 8192.0 * 5.4931640625E-4));
    self->pitch_bend[ch] = 8192;
    self->pitch_range[ch] = 200;
    self->sustain[ch] = 0;
    self->retrigger[ch] = 0;
}

static void reset_all_channels(FunOrbNative* self) {
    for (int ch = 0; ch < 16; ch++) reset_channel(self, ch);
}

static void set_retrigger_param(FunOrbNative* self, int ch, int value) {
    self->retrigger_param[ch] = value;
    self->retrigger_rate[ch] = (int)(0.5 + 2097152.0 * pow(2.0, (double)value * 5.4931640625E-4));
}

static void update_channel_pitch(FunOrbNative* self, int ch) {
    for (int i = 0; i < MAX_VOICES; i++) {
        Voice* v = &self->voices[i];
        if (v->active && v->channel == ch) {
            const Patch* patch = find_patch(self, (self->bank_msb[ch] == 128 || ch == 9) ? 128 : self->program[ch]);
            if (!patch) continue;
            const Region* r = &patch->regions[v->note & 127];
            (void)r;
            v->step_q8 = voice_step_q8(self, ch, v);
        }
    }
}

static int control_period(FunOrbNative* self) {
    int frames = (int)(self->sample_rate / 100.0 + 0.5);
    return frames > 0 ? frames : 1;
}

static void set_gain_ramp(FunOrbNative* self, Voice* v, int frames) {
    int target_l;
    int target_r;
    voice_gains_q6(self, v, &target_l, &target_r);
    if (v->gain_l_q16 == 0 && v->gain_r_q16 == 0 && !v->released && v->age == 0) {
        v->gain_l_q16 = target_l << 16;
        v->gain_r_q16 = target_r << 16;
        v->gain_l_step_q16 = 0;
        v->gain_r_step_q16 = 0;
        v->ramp_remaining = 0;
        return;
    }
    if (frames < 1) frames = 1;
    int target_l_q16 = target_l << 16;
    int target_r_q16 = target_r << 16;
    v->gain_l_step_q16 = (target_l_q16 - v->gain_l_q16) / frames;
    v->gain_r_step_q16 = (target_r_q16 - v->gain_r_q16) / frames;
    v->ramp_remaining = frames;
}

static void advance_voice_control(FunOrbNative* self, Voice* v) {
    const Envelope* env = &v->region->env;
    int tick = 128;
    ++v->age;
    if (env->present) {
        v->vib_phase += env->k;
        if (v->pitch_delta > 0) {
            int decay = (int)(16.0 * pow(2.0, 4.921259842519685E-4 * 8192.0) + 0.5);
            v->pitch_delta -= decay;
            if (v->pitch_delta < 0) v->pitch_delta = 0;
        }
        if (env->a > 0) {
            v->decay_time += env->i > 0 ? (int)(pow(2.0, (double)env->i * 5.086263020833333E-6 * (double)v->region->pitch_base) * (double)tick + 0.5) : tick;
        }
        if (env->d_len > 0) {
            v->amp_time += env->b > 0 ? (int)(pow(2.0, (double)env->b * 5.086263020833333E-6 * (double)v->region->pitch_base) * (double)tick + 0.5) : tick;
            advance_envelope_index(env->d, env->d_len, &v->amp_index, v->amp_time);
            if (v->amp_index == env->d_len - 2 && env->d[v->amp_index + 1] == -1) {
                v->active = 0;
                return;
            }
        }
        if (v->rel_started && env->e_len > 0) {
            v->rel_time += env->j > 0 ? (int)(pow(2.0, (double)env->j * 5.086263020833333E-6 * (double)v->region->pitch_base) * (double)tick + 0.5) : tick;
            advance_envelope_index(env->e, env->e_len, &v->rel_index, v->rel_time);
            if (v->rel_index == env->e_len - 2) {
                v->active = 0;
                return;
            }
        }
    }
    v->step_q8 = voice_step_q8(self, v->channel, v);
    set_gain_ramp(self, v, control_period(self));
}

static void advance_voice_sample(FunOrbNative* self, Voice* v) {
    if (--v->control_countdown <= 0) {
        v->control_countdown = control_period(self);
        advance_voice_control(self, v);
    }
    if (v->ramp_remaining > 0) {
        v->gain_l_q16 += v->gain_l_step_q16;
        v->gain_r_q16 += v->gain_r_step_q16;
        --v->ramp_remaining;
    }
}

static void restart_voice_stream(FunOrbNative* self, Voice* v, int fade_frames) {
    const Sample* sample = v->sample;
    int keep_step = v->step_q8;
    int keep_direction = v->direction;
    v->pos_q8 = 0;
    v->direction = keep_direction == 0 ? 1 : keep_direction;
    if (self->start_pos[v->channel] > 0) {
        double pos;
        if (sample->pingpong && sample->loop_end > sample->loop_start) {
            double span = (double)(sample->length + sample->length - sample->loop_start);
            pos = (double)self->start_pos[v->channel] * span / 16384.0;
            if (pos >= sample->length) {
                v->direction = -1;
                pos = (double)(sample->length + sample->length) - 1.0 - pos;
            }
        } else {
            pos = (double)self->start_pos[v->channel] * (double)sample->length / 16384.0;
        }
        if (pos >= 0.0 && pos < sample->length) {
            v->pos_q8 = (int)(pos * 256.0 + 0.5);
        }
    }
    v->step_q8 = keep_step;
    v->gain_l_q16 = 0;
    v->gain_r_q16 = 0;
    set_gain_ramp(self, v, fade_frames);
}

static void render_native(FunOrbNative* self, uint32_t offset, uint32_t frames) {
    for (uint32_t i = 0; i < frames; i++) {
        int32_t mix_l = 0;
        int32_t mix_r = 0;
        for (int vi = 0; vi < MAX_VOICES; vi++) {
            Voice* v = &self->voices[vi];
            if (!v->active) continue;
            advance_voice_sample(self, v);
            if (!v->active) continue;
            const Sample* s = v->sample;
            int idx = v->pos_q8 >> 8;
            if (idx < 0 || idx >= s->length) {
                v->active = 0;
                continue;
            }
            int next = idx + v->direction;
            if (next < 0) next = 0;
            if (next >= s->length) next = s->length - 1;
            int frac = v->pos_q8 & 0xFF;
            int s0 = s->pcm[idx];
            int s1 = s->pcm[next];
            int interp = (s0 << 8) + (s1 - s0) * frac;
            int gain_l = v->gain_l_q16 >> 16;
            int gain_r = v->gain_r_q16 >> 16;
            mix_l += (interp * gain_l) >> 12;
            mix_r += (interp * gain_r) >> 12;
            if (v->released) {
                v->release_gain *= 0.9995f;
                if (v->release_gain < 0.0001f) {
                    v->active = 0;
                    continue;
                }
            }
            if (self->retrigger[v->channel] && !v->released) {
                int phase_step = (int)((double)self->retrigger_rate[v->channel] / self->sample_rate + 0.5);
                if (phase_step < 1) phase_step = 1;
                v->retrigger_phase_q20 += phase_step;
                if (v->retrigger_phase_q20 >= 0x100000) {
                    v->retrigger_phase_q20 &= 0xFFFFF;
                    int fade = control_period(self);
                    int max_fade = 262144 / phase_step;
                    if (max_fade > 0 && max_fade < fade) fade = max_fade;
                    restart_voice_stream(self, v, fade);
                }
            }
            v->pos_q8 += v->step_q8 * v->direction;
            int length_q8 = s->length << 8;
            int loop_start_q8 = s->loop_start << 8;
            int loop_end_q8 = s->loop_end << 8;
            if (v->pos_q8 >= length_q8) {
                if (s->loop_end > s->loop_start) {
                    if (s->pingpong) {
                        v->pos_q8 = loop_end_q8 - 1 - (v->pos_q8 - loop_end_q8);
                        v->direction = -1;
                    } else {
                        while (v->pos_q8 >= loop_end_q8) {
                            v->pos_q8 = loop_start_q8 + (v->pos_q8 - loop_end_q8);
                        }
                    }
                } else {
                    v->active = 0;
                }
            } else if (v->pos_q8 < loop_start_q8 && v->direction < 0) {
                if (s->loop_end > s->loop_start && s->pingpong) {
                    v->pos_q8 = loop_start_q8 + (loop_start_q8 - v->pos_q8);
                    v->direction = 1;
                } else if (v->pos_q8 < 0) {
                    v->active = 0;
                }
            }
        }
        float l = (float)mix_l / 524288.0f;
        float r = (float)mix_r / 524288.0f;
        if (l < -1.0f) l = -1.0f;
        if (l > 1.0f) l = 1.0f;
        if (r < -1.0f) r = -1.0f;
        if (r > 1.0f) r = 1.0f;
        self->audio_l[offset + i] = l;
        self->audio_r[offset + i] = r;
    }
}

static const LV2_URID_Map* find_map(const LV2_Feature* const* features) {
    if (!features) return NULL;
    for (int i = 0; features[i]; i++) {
        if (!strcmp(features[i]->URI, LV2_URID__map)) return (const LV2_URID_Map*)features[i]->data;
    }
    return NULL;
}

static LV2_Handle instantiate(const LV2_Descriptor* descriptor, double rate, const char* bundle_path, const LV2_Feature* const* features) {
    (void)descriptor;
    const LV2_URID_Map* map = find_map(features);
    if (!map) return NULL;
    FunOrbNative* self = (FunOrbNative*)calloc(1, sizeof(FunOrbNative));
    self->sample_rate = rate;
    self->midi_event = map->map(map->handle, LV2_MIDI__MidiEvent);
    reset_all_channels(self);
    char* bank = join_path(bundle_path, "funorb_tetralink.fobank");
    if (!load_bank(self, bank)) {
        fprintf(stderr, "funorb-native.lv2: failed to load %s\n", bank);
    }
    free(bank);
    return (LV2_Handle)self;
}

static void connect_port(LV2_Handle instance, uint32_t port, void* data) {
    FunOrbNative* self = (FunOrbNative*)instance;
    if (port == PORT_MIDI_IN) self->midi_in = (const LV2_Atom_Sequence*)data;
    else if (port == PORT_AUDIO_L) self->audio_l = (float*)data;
    else if (port == PORT_AUDIO_R) self->audio_r = (float*)data;
}

static void handle_midi(FunOrbNative* self, const uint8_t* msg, uint32_t size) {
    if (size < 1 || msg[0] >= 0xF0) return;
    int ch = msg[0] & 0x0F;
    int type = msg[0] & 0xF0;
    if (type == 0x80 && size >= 3) note_off(self, ch, msg[1] & 0x7F);
    else if (type == 0x90 && size >= 3) {
        if ((msg[2] & 0x7F) == 0) note_off(self, ch, msg[1] & 0x7F);
        else note_on(self, ch, msg[1] & 0x7F, msg[2] & 0x7F);
    } else if (type == 0xB0 && size >= 3) {
        int cc = msg[1] & 0x7F;
        int value = msg[2] & 0x7F;
        if (cc == 0) self->bank_msb[ch] = value;
        else if (cc == 32) self->bank_lsb[ch] = value;
        else if (cc == 1) self->modulation[ch] = (self->modulation[ch] & 0x7F) | (value << 7);
        else if (cc == 33) self->modulation[ch] = (self->modulation[ch] & 0x3F80) | value;
        else if (cc == 16) self->start_pos[ch] = (self->start_pos[ch] & 0x7F) | (value << 7);
        else if (cc == 48) self->start_pos[ch] = (self->start_pos[ch] & 0x3F80) | value;
        else if (cc == 17) set_retrigger_param(self, ch, (self->retrigger_param[ch] & 0x7F) | (value << 7));
        else if (cc == 49) set_retrigger_param(self, ch, (self->retrigger_param[ch] & 0x3F80) | value);
        else if (cc == 7) self->volume[ch] = (self->volume[ch] & 0x7F) | (value << 7);
        else if (cc == 39) self->volume[ch] = (self->volume[ch] & 0x3F80) | value;
        else if (cc == 10) self->pan[ch] = (self->pan[ch] & 0x7F) | (value << 7);
        else if (cc == 42) self->pan[ch] = (self->pan[ch] & 0x3F80) | value;
        else if (cc == 11) self->expression[ch] = (self->expression[ch] & 0x7F) | (value << 7);
        else if (cc == 43) self->expression[ch] = (self->expression[ch] & 0x3F80) | value;
        else if (cc == 64) {
            if (value >= 64) self->sustain[ch] = 1;
            else sustain_off(self, ch);
        } else if (cc == 81) {
            self->retrigger[ch] = value >= 64;
        } else if (cc == 120 || cc == 123) {
            all_notes_off(self, ch);
        } else if (cc == 121) {
            reset_channel(self, ch);
        }
    } else if (type == 0xC0 && size >= 2) {
        self->program[ch] = msg[1] & 0x7F;
    } else if (type == 0xE0 && size >= 3) {
        self->pitch_bend[ch] = (msg[1] & 0x7F) | ((msg[2] & 0x7F) << 7);
        update_channel_pitch(self, ch);
    }
}

static void run(LV2_Handle instance, uint32_t sample_count) {
    FunOrbNative* self = (FunOrbNative*)instance;
    if (!self->audio_l || !self->audio_r) return;
    memset(self->audio_l, 0, sizeof(float) * sample_count);
    memset(self->audio_r, 0, sizeof(float) * sample_count);
    uint32_t offset = 0;
    if (self->midi_in) {
        LV2_ATOM_SEQUENCE_FOREACH(self->midi_in, ev) {
            if (ev->body.type != self->midi_event) continue;
            uint32_t frame = ev->time.frames < 0 ? 0 : (uint32_t)ev->time.frames;
            if (frame > sample_count) frame = sample_count;
            render_native(self, offset, frame - offset);
            offset = frame;
            handle_midi(self, (const uint8_t*)(ev + 1), ev->body.size);
        }
    }
    render_native(self, offset, sample_count - offset);
}

static void cleanup(LV2_Handle instance) {
    FunOrbNative* self = (FunOrbNative*)instance;
    if (!self) return;
    for (int i = 0; i < self->sample_count; i++) free(self->samples[i].pcm);
    for (int i = 0; i < self->patch_count; i++) {
        for (int n = 0; n < 128; n++) {
            free(self->patches[i].regions[n].env.d);
            free(self->patches[i].regions[n].env.e);
        }
    }
    free(self->samples);
    free(self->patches);
    free(self);
}

static const void* extension_data(const char* uri) {
    (void)uri;
    return NULL;
}

static const LV2_Descriptor descriptor = { FUNORB_NATIVE_URI, instantiate, connect_port, NULL, run, NULL, cleanup, extension_data };

LV2_SYMBOL_EXPORT const LV2_Descriptor* lv2_descriptor(uint32_t index) {
    return index == 0 ? &descriptor : NULL;
}

#ifdef FUNORB_NATIVE_SELFTEST
int main(int argc, char** argv) {
    const char* bank = argc > 1 ? argv[1] : ".work/music/tetralink-build17/native/funorb_tetralink.fobank";
    enum { frames = 4096 };
    FunOrbNative* self = (FunOrbNative*)calloc(1, sizeof(FunOrbNative));
    if (!self) return 2;
    self->sample_rate = 22050.0;
    self->audio_l = (float*)calloc(frames, sizeof(float));
    self->audio_r = (float*)calloc(frames, sizeof(float));
    if (!self->audio_l || !self->audio_r) return 2;
    reset_all_channels(self);
    if (!load_bank(self, bank)) return 3;
    self->program[0] = 0;
    note_on(self, 0, 60, 96);
    render_native(self, 0, frames);
    double energy = 0.0;
    for (int i = 0; i < frames; i++) {
        energy += fabs(self->audio_l[i]) + fabs(self->audio_r[i]);
    }
    printf("frames=%d energy=%.9f\n", frames, energy);
    free(self->audio_l);
    free(self->audio_r);
    cleanup(self);
    return energy > 0.000001 ? 0 : 4;
}
#endif
