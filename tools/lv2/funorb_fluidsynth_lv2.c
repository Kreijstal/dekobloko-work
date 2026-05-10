#include <math.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include <fluidsynth.h>
#include <lv2/atom/atom.h>
#include <lv2/atom/util.h>
#include <lv2/core/lv2.h>
#include <lv2/midi/midi.h>
#include <lv2/urid/urid.h>

#define FUNORB_URI "https://funorb.local/lv2/funorb-fluidsynth"

enum {
    PORT_MIDI_IN = 0,
    PORT_AUDIO_L = 1,
    PORT_AUDIO_R = 2
};

typedef struct {
    const LV2_Atom_Sequence* midi_in;
    float* audio_l;
    float* audio_r;
    LV2_URID midi_event;
    fluid_settings_t* settings;
    fluid_synth_t* synth;
} FunOrbFluidSynth;

static char* join_path(const char* base, const char* name) {
    size_t base_len = strlen(base);
    size_t name_len = strlen(name);
    int need_slash = base_len > 0 && base[base_len - 1] != '/';
    char* out = (char*)calloc(base_len + name_len + (need_slash ? 2 : 1), 1);
    if (!out) {
        return NULL;
    }
    memcpy(out, base, base_len);
    if (need_slash) {
        out[base_len++] = '/';
    }
    memcpy(out + base_len, name, name_len);
    return out;
}

static const LV2_URID_Map* find_map(const LV2_Feature* const* features) {
    if (!features) {
        return NULL;
    }
    for (int i = 0; features[i]; i++) {
        if (!strcmp(features[i]->URI, LV2_URID__map)) {
            return (const LV2_URID_Map*)features[i]->data;
        }
    }
    return NULL;
}

static LV2_Handle instantiate(
    const LV2_Descriptor* descriptor,
    double rate,
    const char* bundle_path,
    const LV2_Feature* const* features
) {
    (void)descriptor;
    FunOrbFluidSynth* self = (FunOrbFluidSynth*)calloc(1, sizeof(FunOrbFluidSynth));
    if (!self) {
        return NULL;
    }

    const LV2_URID_Map* map = find_map(features);
    if (!map) {
        free(self);
        return NULL;
    }
    self->midi_event = map->map(map->handle, LV2_MIDI__MidiEvent);

    self->settings = new_fluid_settings();
    if (!self->settings) {
        free(self);
        return NULL;
    }
    fluid_settings_setnum(self->settings, "synth.sample-rate", rate);
    fluid_settings_setnum(self->settings, "synth.gain", 0.6);
    fluid_settings_setint(self->settings, "synth.threadsafe-api", 0);
    fluid_settings_setint(self->settings, "synth.chorus.active", 0);
    fluid_settings_setint(self->settings, "synth.reverb.active", 0);

    self->synth = new_fluid_synth(self->settings);
    if (!self->synth) {
        delete_fluid_settings(self->settings);
        free(self);
        return NULL;
    }

    const char* env_sf2 = getenv("FUNORB_SF2_PATH");
    char* bundled_sf2 = env_sf2 ? NULL : join_path(bundle_path, "funorb_tetralink.sf2");
    const char* sf2_path = env_sf2 ? env_sf2 : bundled_sf2;
    if (!sf2_path || fluid_synth_sfload(self->synth, sf2_path, 1) < 0) {
        fprintf(stderr, "funorb-fluidsynth.lv2: failed to load %s\n", sf2_path ? sf2_path : "(null)");
    }
    free(bundled_sf2);
    return (LV2_Handle)self;
}

static void connect_port(LV2_Handle instance, uint32_t port, void* data) {
    FunOrbFluidSynth* self = (FunOrbFluidSynth*)instance;
    switch (port) {
        case PORT_MIDI_IN:
            self->midi_in = (const LV2_Atom_Sequence*)data;
            break;
        case PORT_AUDIO_L:
            self->audio_l = (float*)data;
            break;
        case PORT_AUDIO_R:
            self->audio_r = (float*)data;
            break;
    }
}

static void render(FunOrbFluidSynth* self, uint32_t offset, uint32_t frames) {
    if (frames == 0) {
        return;
    }
    fluid_synth_write_float(
        self->synth,
        (int)frames,
        self->audio_l + offset,
        0,
        1,
        self->audio_r + offset,
        0,
        1
    );
}

static void handle_midi(FunOrbFluidSynth* self, const uint8_t* msg, uint32_t size) {
    if (size == 0) {
        return;
    }
    uint8_t status = msg[0];
    uint8_t type = status & 0xF0;
    uint8_t chan = status & 0x0F;
    if (status >= 0xF0) {
        return;
    }
    if (type == 0x80 && size >= 3) {
        fluid_synth_noteoff(self->synth, chan, msg[1] & 0x7F);
    } else if (type == 0x90 && size >= 3) {
        uint8_t vel = msg[2] & 0x7F;
        if (vel) {
            fluid_synth_noteon(self->synth, chan, msg[1] & 0x7F, vel);
        } else {
            fluid_synth_noteoff(self->synth, chan, msg[1] & 0x7F);
        }
    } else if (type == 0xB0 && size >= 3) {
        fluid_synth_cc(self->synth, chan, msg[1] & 0x7F, msg[2] & 0x7F);
    } else if (type == 0xC0 && size >= 2) {
        fluid_synth_program_change(self->synth, chan, msg[1] & 0x7F);
    } else if (type == 0xE0 && size >= 3) {
        fluid_synth_pitch_bend(self->synth, chan, ((msg[2] & 0x7F) << 7) | (msg[1] & 0x7F));
    }
}

static void run(LV2_Handle instance, uint32_t sample_count) {
    FunOrbFluidSynth* self = (FunOrbFluidSynth*)instance;
    if (!self->audio_l || !self->audio_r || !self->synth) {
        return;
    }
    memset(self->audio_l, 0, sizeof(float) * sample_count);
    memset(self->audio_r, 0, sizeof(float) * sample_count);

    uint32_t offset = 0;
    if (self->midi_in) {
        LV2_ATOM_SEQUENCE_FOREACH(self->midi_in, ev) {
            if (ev->body.type != self->midi_event) {
                continue;
            }
            uint32_t frame = ev->time.frames < 0 ? 0 : (uint32_t)ev->time.frames;
            if (frame > sample_count) {
                frame = sample_count;
            }
            render(self, offset, frame - offset);
            offset = frame;
            handle_midi(self, (const uint8_t*)(ev + 1), ev->body.size);
        }
    }
    render(self, offset, sample_count - offset);
}

static void cleanup(LV2_Handle instance) {
    FunOrbFluidSynth* self = (FunOrbFluidSynth*)instance;
    if (!self) {
        return;
    }
    if (self->synth) {
        delete_fluid_synth(self->synth);
    }
    if (self->settings) {
        delete_fluid_settings(self->settings);
    }
    free(self);
}

static const void* extension_data(const char* uri) {
    (void)uri;
    return NULL;
}

static const LV2_Descriptor descriptor = {
    FUNORB_URI,
    instantiate,
    connect_port,
    NULL,
    run,
    NULL,
    cleanup,
    extension_data
};

LV2_SYMBOL_EXPORT const LV2_Descriptor* lv2_descriptor(uint32_t index) {
    return index == 0 ? &descriptor : NULL;
}
