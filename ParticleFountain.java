/*
 * ParticleFountain.java
 *
 * A self-contained Java applet game written for the java-tools browser JVM
 * (Kreijstal/java-tools, the same runtime that powers GeoBlox).
 *
 * Demonstrates, using only APIs implemented by the runtime's JS JRE:
 *
 *   - Software rendering through the existing pixel-buffer/presentation path:
 *       int[] framebuffer -> MemoryImageSource(w,h,pixels,0,w) -> newPixels()
 *       -> Component.getGraphics().drawImage(...)  (incremental canvas upload)
 *
 *   - Clipping: scissor rectangles inside the rasterizer (viewport, HUD band,
 *     scrolling marquee band), plus Graphics.clipRect on the present path.
 *
 *   - Transparency: per-pixel alpha-over blending for sprites and additive
 *     blending for glows, all done in software on packed 0xAARRGGBB pixels.
 *
 *   - Moving sprites + collisions: pooled particles vs walls, vs drifting
 *     targets (AABB) and vs the scripted paddle.
 *
 *   - Fixed-seed procedural assets: every sprite, the starfield and the
 *     bitmap font are generated at init() from one xorshift seed.
 *     No asset files, no network, no prerecorded frames.
 *
 *   - Scripted input: the paddle and the fountain are driven by a
 *     deterministic timeline; there is no live input and no RNG at runtime
 *     beyond the fixed seed.
 *
 *   - Generated audio via a sample framebuffer: a SoundChip mixes a fixed
 *     number of synth voices into a per-frame PCM buffer (the audio analogue
 *     of the pixel framebuffer) and pumps it into javax.sound.sampled
 *     SourceDataLine with backpressure, exactly like the FunOrb clients do.
 *
 *   - A particle fountain with short-lived objects: a fixed-size particle
 *     pool with an explicit freelist; particles are recycled, never GC'd.
 *
 * Headless verification: running main() plays a bounded, deterministic number
 * of frames, prints framebuffer checksums and an ASCII-art downsample of real
 * rendered frames, then exits. In a browser host the normal applet lifecycle
 * (init/start/stop) drives an unbounded animator thread instead.
 *
 * Uses no generics, enums, varargs, anonymous classes, inner classes or 2D
 * arrays - it stays inside the subset compiler's comfort zone on purpose.
 */

import java.applet.Applet;
import java.awt.Graphics;
import java.awt.Image;
import java.awt.image.MemoryImageSource;
import javax.sound.sampled.AudioFormat;
import javax.sound.sampled.AudioSystem;
import javax.sound.sampled.LineUnavailableException;
import javax.sound.sampled.SourceDataLine;

public class ParticleFountain extends Applet implements Runnable {

    // ---- world constants ----------------------------------------------------
    public static final int W = 360;
    public static final int H = 240;
    public static final int SEED = 0x5EEDF00D;

    public static final int HUD_TOP = 14;          // top HUD band height
    public static final int MARQUEE_H = 12;        // bottom marquee band height
    public static final int VIEW_Y = HUD_TOP;      // world viewport top
    public static final int VIEW_H = H - HUD_TOP - MARQUEE_H;

    public static final int MAX_PARTICLES = 320;
    public static final int MAX_TARGETS = 6;
    public static final int MAX_WAVES = 10;

    // ---- engine state -------------------------------------------------------
    Surface surface;
    SoundChip sound;
    Script script;
    Paddle paddle;
    Fountain fountain;
    Target[] targets;
    Particle[] pool;
    int[] freeStack;
    int freeTop;
    Shockwave[] waves;
    Rng rng;

    Image screen;
    MemoryImageSource source;
    Graphics present;

    boolean running;
    boolean autoMode;      // bounded deterministic run (verification / CI)
    int autoFrames = 240;
    int frames;
    long lastMs;
    int fpsEma;          // smoothed frame time in ms * 100
    int score;
    int hits;
    int bouncesThisFrame;
    int spawnedTotal;

    // ---- applet lifecycle ---------------------------------------------------

    public void init() {
        Assets.build(SEED);

        surface = new Surface(W, H);
        rng = new Rng(SEED ^ 0x7A11);
        sound = new SoundChip();
        sound.open();

        pool = new Particle[MAX_PARTICLES];
        freeStack = new int[MAX_PARTICLES];
        freeTop = MAX_PARTICLES;
        for (int i = 0; i < MAX_PARTICLES; i++) {
            pool[i] = new Particle(this);
            freeStack[i] = MAX_PARTICLES - 1 - i;
        }

        targets = new Target[MAX_TARGETS];
        waves = new Shockwave[MAX_WAVES];
        for (int i = 0; i < MAX_WAVES; i++) {
            waves[i] = new Shockwave(this);
        }

        paddle = new Paddle(this);
        fountain = new Fountain(this);
        script = new Script(this);

        // Bounded deterministic mode: hosts (CI, headless runners) pass an
        // applet parameter instead of relying on main(), which the browser
        // JVM never calls for applet classes.
        String autoParam = getParameter("autoframes");
        if (autoParam != null) {
            autoMode = true;
            int parsed = 0;
            int i = 0;
            while (i < autoParam.length() && autoParam.charAt(i) >= '0'
                    && autoParam.charAt(i) <= '9') {
                parsed = parsed * 10 + (autoParam.charAt(i) - '0');
                i++;
            }
            if (parsed > 0) {
                autoFrames = parsed;
            }
        }

        try {
            setSize(W, H);
        } catch (RuntimeException e) {
            // headless platforms may not support resize; harmless
        }

        MemoryImageSource mis = new MemoryImageSource(W, H, surface.pixels, 0, W);
        source = mis;
        screen = createImage(mis);
    }

    public void start() {
        running = true;
        Thread animator = new Thread(this, "particle-fountain-loop");
        animator.start();
    }

    public void stop() {
        running = false;
    }

    public void run() {
        lastMs = System.currentTimeMillis();
        while (running || autoMode) {
            long now = System.currentTimeMillis();
            int dt = (int) (now - lastMs);
            lastMs = now;
            if (dt < 1) {
                dt = 1;
            }
            if (dt > 100) {
                dt = 100;
            }
            if (autoMode) {
                dt = 16; // fixed timestep keeps bounded runs deterministic
            }
            fpsEma = (fpsEma * 90 + dt * 10) / 100;

            step(dt);
            render();
            present();
            sound.pump(dt);

            frames++;
            if (autoMode) {
                if (frames == 40 || frames == 80 || frames == 120) {
                    int sum = checksum();
                    String line = "CHK frame=" + frames + " sum=" + sum;
                    System.out.println(line);
                }
                if (frames == 60) {
                    dumpAscii();
                }
                if (frames >= autoFrames) {
                    break;
                }
            }

            try {
                Thread.sleep(14);
            } catch (InterruptedException e) {
                running = false;
            }
        }
        if (autoMode) {
            printSummary();
        }
    }

    // ---- world update -------------------------------------------------------

    void step(int dt) {
        bouncesThisFrame = 0;

        script.step(dt);
        paddle.step(dt);
        fountain.step(dt);

        for (int i = 0; i < MAX_TARGETS; i++) {
            Target t = targets[i];
            if (t != null && t.alive) {
                t.step(dt);
            }
        }

        for (int i = 0; i < MAX_PARTICLES; i++) {
            Particle p = pool[i];
            if (p.alive) {
                p.step(dt);
            }
        }

        for (int i = 0; i < MAX_WAVES; i++) {
            Shockwave w = waves[i];
            if (w.alive) {
                w.step(dt);
            }
        }
    }

    /** Pops a particle from the pool, or null when exhausted (never allocates). */
    Particle acquireParticle() {
        if (freeTop == 0) {
            return null;
        }
        freeTop--;
        Particle p = pool[freeStack[freeTop]];
        p.index = freeStack[freeTop];
        p.alive = true;
        spawnedTotal++;
        return p;
    }

    void releaseParticle(Particle p) {
        if (!p.alive) {
            return; // guard against double release
        }
        p.alive = false;
        freeStack[freeTop] = p.index;
        freeTop++;
    }

    void onBounce() {
        bouncesThisFrame++;
        if (bouncesThisFrame <= 3) {
            sound.tick();
        }
    }

    void onCatch(Particle p) {
        score += 1;
        sound.blip(660, 120, 90);
        spawnWave(p.x, p.y, 10, 20);
    }

    void onTargetHit(Target t, Particle p) {
        hits++;
        t.hp--;
        if (t.hp <= 0) {
            t.alive = false;
            score += 10;
            sound.chord();
            spawnWave(t.x + t.width / 2, t.y + t.height / 2, 30, 26);
            fountain.burst(8, 220, 150);
        } else {
            sound.hit();
            spawnWave(p.x, p.y, 8, 12);
        }
    }

    void spawnWave(int cx, int cy, int radius, int life) {
        for (int i = 0; i < MAX_WAVES; i++) {
            Shockwave w = waves[i];
            if (!w.alive) {
                w.start(cx, cy, radius, life);
                return;
            }
        }
    }

    // ---- rendering ----------------------------------------------------------

    void render() {
        surface.blitBackground(Assets.background, W, H);

        // subtle seeded twinkle over the static starfield
        for (int i = 0; i < Assets.TWINKLES; i++) {
            int sx = Assets.twinkleX(i);
            int sy = Assets.twinkleY(i);
            int phase = Assets.twinklePhase(i);
            int bright = (int) ((Math.sin((frames + phase) * 0.11) + 1.0) * 45.0);
            surface.plotAdd(sx, sy, 0xBFD8FF, 30 + bright);
        }

        surface.clip(0, VIEW_Y, W, VIEW_H);

        for (int i = 0; i < MAX_WAVES; i++) {
            Shockwave w = waves[i];
            if (w.alive) {
                w.render(surface);
            }
        }

        for (int i = 0; i < MAX_TARGETS; i++) {
            Target t = targets[i];
            if (t != null && t.alive) {
                t.render(surface);
            }
        }

        for (int i = 0; i < MAX_PARTICLES; i++) {
            Particle p = pool[i];
            if (p.alive) {
                p.render(surface);
            }
        }

        paddle.render(surface);

        surface.resetClip();

        drawHud();
        drawMarquee();
    }

    void drawHud() {
        surface.clip(0, 0, W, HUD_TOP);
        surface.fill(0, 0, W, HUD_TOP, 0xFF101820);
        surface.hline(0, W - 1, HUD_TOP - 1, 0xFF2A3B4D);

        surface.text(Assets.SCORE_TEXT, 4, 4, 0xFF9FD356);
        surface.drawInt(score, 46, 4, 0xFFFFFFFF, 6);

        surface.text(Assets.HITS_TEXT, 116, 4, 0xFFE8A33D);
        surface.drawInt(hits, 148, 4, 0xFFFFFFFF, 4);

        surface.text(Assets.FPS_TEXT, 204, 4, 0xFF7FB4D8);
        int fps = fpsEma > 0 ? 10000 / fpsEma : 0;
        surface.drawInt(fps, 232, 4, 0xFFFFFFFF, 3);

        surface.resetClip();
    }

    void drawMarquee() {
        surface.clip(0, H - MARQUEE_H, W, MARQUEE_H);
        surface.fill(0, H - MARQUEE_H, W, MARQUEE_H, 0xFF101820);
        surface.hline(0, W - 1, H - MARQUEE_H, 0xFF2A3B4D);

        int textW = Assets.MARQUEE_LEN * 4;
        int scroll = (frames * 22) % textW;
        int x = W - scroll;
        while (x < W) {
            surface.text(Assets.marquee, x, H - MARQUEE_H + 3, 0xFF5E8CA8);
            x += textW;
        }

        surface.resetClip();
    }

    // ---- presentation (the pixel-buffer path) --------------------------------

    void present() {
        source.newPixels();
        present = getGraphics();
        if (present != null) {
            present.clipRect(0, 0, W, H);
            present.drawImage(screen, 0, 0, null);
            present.dispose();
            present = null;
        }
    }

    public void paint(Graphics g) {
        if (screen != null) {
            g.drawImage(screen, 0, 0, null);
        }
    }

    public void update(Graphics g) {
        paint(g);
    }

    // ---- headless verification ----------------------------------------------

    int checksum() {
        int sum = 0;
        int[] px = surface.pixels;
        for (int i = 0; i < px.length; i += 7) {
            sum = sum * 31 + px[i];
        }
        return sum;
    }

    void dumpAscii() {
        String ramp = " .:-=+*#%@";
        int step = 4;
        StringBuilder sb = new StringBuilder();
        for (int y = 0; y < H; y += step * 2) {
            for (int x = 0; x < W; x += step) {
                int argb = surface.pixels[y * W + x];
                int r = (argb >> 16) & 255;
                int g = (argb >> 8) & 255;
                int b = argb & 255;
                int lum = (r * 3 + g * 5 + b * 2) / 10;
                int idx = lum / 26;
                if (idx > 9) {
                    idx = 9;
                }
                char ch = ramp.charAt(idx);
                sb.append(ch);
            }
            sb.append('\n');
        }
        String banner = "--- framebuffer @frame " + frames + " ---";
        System.out.println(banner);
        String art = sb.toString();
        System.out.println(art);
    }

    void printSummary() {
        int finalSum = checksum();
        String line1 = "--- summary ---";
        System.out.println(line1);
        String line2 = "frames=" + frames
                + " score=" + score
                + " hits=" + hits
                + " spawnedParticles=" + spawnedTotal
                + " poolFree=" + freeTop + "/" + MAX_PARTICLES
                + " audioReady=" + sound.ready
                + " finalChecksum=" + finalSum;
        System.out.println(line2);
        dumpAscii();
    }

    public static void main(String[] args) {
        ParticleFountain app = new ParticleFountain();
        app.autoMode = true;
        if (args != null && args.length > 0) {
            app.autoFrames = Integer.parseInt(args[0]);
        }
        app.init();
        app.run();
    }
}

// ============================================================================
// Small entity hierarchy: one abstract update/draw contract, five concrete
// behaviours. Every entity is long-lived except Particle/Shockwave, which are
// pooled and recycled.
// ============================================================================

abstract class Entity {
    final ParticleFountain game;
    int x;
    int y;
    boolean alive;

    Entity(ParticleFountain game) {
        this.game = game;
        this.alive = true;
    }

    abstract void step(int dt);

    abstract void render(Surface s);
}

/** The scripted player: a paddle that slides along the bottom catching sparks. */
class Paddle extends Entity {
    static final int PW = 44;
    static final int PH = 8;

    Paddle(ParticleFountain game) {
        super(game);
        y = ParticleFountain.H - ParticleFountain.MARQUEE_H - 6 - PH;
    }

    void step(int dt) {
        // Scripted input: pure function of the global timeline, no live events.
        double t = game.script.t;
        int px = ParticleFountain.W / 2
                + (int) (88.0 * Math.sin(t * 0.0017)
                + 36.0 * Math.sin(t * 0.0043 + 1.7));
        if (px < PW / 2 + 2) {
            px = PW / 2 + 2;
        }
        if (px > ParticleFountain.W - PW / 2 - 2) {
            px = ParticleFountain.W - PW / 2 - 2;
        }
        x = px - PW / 2;
    }

    boolean contains(int px, int py) {
        return px >= x && px < x + PW && py >= y && py < y + PH + 2;
    }

    void render(Surface s) {
        s.blitAlpha(Assets.paddle, x, y);
    }
}

/** The emitter: aims and fires particles from the paddle on a script. */
class Fountain extends Entity {
    int aim;          // fixed-point angle, 0..1023 == 0..2pi
    int cooldown;

    Fountain(ParticleFountain game) {
        super(game);
        alive = true;
    }

    void step(int dt) {
        // Aim sweeps on a scripted lissajous path.
        double t = game.script.t;
        double base = -1.5707963; // -pi/2, straight up
        double sweep = 0.62 * Math.sin(t * 0.0011)
                + 0.22 * Math.sin(t * 0.0037 + 0.9);
        aim = (int) ((base + sweep) * 1024.0 / 6.2831853) & 1023;

        cooldown -= dt;
        if (cooldown <= 0) {
            cooldown = game.script.nextBurstDelay();
            int n = game.script.nextBurstCount();
            burst(n, 150, 190);
        }
    }

    /** Fires n particles with speed in [minSpeed, maxSpeed). */
    void burst(int n, int minSpeed, int maxSpeed) {
        Paddle p = game.paddle;
        int ox = p.x + Paddle.PW / 2;
        int oy = p.y - 2;
        for (int i = 0; i < n; i++) {
            Particle part = game.acquireParticle();
            if (part == null) {
                return; // pool exhausted: this frame simply emits less
            }
            int speed = game.rng.between(minSpeed, maxSpeed);
            int jitter = game.rng.between(-28, 28);
            part.spawn(ox, oy, aim + jitter, speed);
            if (i == 0) {
                game.sound.blip(880, 60, 40);
            }
        }
    }

    void render(Surface s) {
        // emitter muzzle glow riding on the paddle
        int ox = game.paddle.x + Paddle.PW / 2;
        int oy = game.paddle.y - 4;
        s.blitAddTinted(Assets.glow, ox - 6, oy - 6, 0x66E0FF, 120);
    }
}

/** Short-lived pooled particle with additive glow rendering. */
class Particle extends Entity {
    int index;
    int vx;
    int vy;
    int life;
    int maxLife;
    int tint;
    int shade;   // 0..256 glow strength, decays with life

    Particle(ParticleFountain game) {
        super(game);
        alive = false;
    }

    void spawn(int px, int py, int angle1024, int speed) {
        // angle1024: 0..1023 == 0..2pi, fixed-point to stay int-only
        double a = angle1024 * 6.2831853 / 1024.0;
        x = px;
        y = py;
        vx = (int) (Math.cos(a) * speed);
        vy = (int) (Math.sin(a) * speed);
        life = 90 + game.rng.nextInt(70);
        maxLife = life;
        int hue = game.rng.nextInt(3);
        tint = hue == 0 ? 0x66D9FF : (hue == 1 ? 0xFFD166 : 0xFF6B9E);
        shade = 256;
    }

    void step(int dt) {
        vy += 5;                      // gravity
        x += vx;
        y += vy;

        if (x < 1) {
            x = 1;
            vx = -vx * 82 / 100;
            game.onBounce();
        } else if (x > ParticleFountain.W - 2) {
            x = ParticleFountain.W - 2;
            vx = -vx * 82 / 100;
            game.onBounce();
        }
        if (y < ParticleFountain.VIEW_Y + 1) {
            y = ParticleFountain.VIEW_Y + 1;
            vy = -vy * 82 / 100;
            game.onBounce();
        }

        // collide with targets (point vs AABB)
        for (int i = 0; i < ParticleFountain.MAX_TARGETS; i++) {
            Target t = game.targets[i];
            if (t != null && t.alive && t.contains(x, y)) {
                game.onTargetHit(t, this);
                if (!alive) {
                    return;
                }
            }
        }

        // caught by the paddle while falling
        if (vy > 0 && game.paddle.contains(x, y)) {
            game.onCatch(this);
            die();
            return;
        }

        life--;
        shade = 256 * life / maxLife;
        if (life <= 0 || y > ParticleFountain.H - 2) {
            die();
        }
    }

    void die() {
        game.releaseParticle(this);
    }

    void render(Surface s) {
        s.blitAddTinted(Assets.glow, x - 4, y - 4, tint, shade);
        s.plotAdd(x, y, 0xFFFFFF, 128 + shade / 2);
    }
}

/** A drifting block that eats particles. Dies after three hits. */
class Target extends Entity {
    static final int TW = 18;
    static final int TH = 12;

    int width = TW;
    int height = TH;
    int hp;
    int driftPhase;
    int driftAmp;

    Target(ParticleFountain game) {
        super(game);
        alive = false;
    }

    void startAt(int px, int py) {
        x = px;
        y = py;
        hp = 3;
        alive = true;
        driftPhase = game.rng.nextInt(1024);
        driftAmp = 6 + game.rng.nextInt(14);
    }

    void step(int dt) {
        y += (int) (Math.sin((game.script.t + driftPhase * 61) * 0.0013) * 0.4);
        x += (int) (Math.sin((game.script.t + driftPhase) * 0.0009) * driftAmp * 0.02);
        if (x < 2) {
            x = 2;
        }
        if (x > ParticleFountain.W - width - 2) {
            x = ParticleFountain.W - width - 2;
        }
    }

    boolean contains(int px, int py) {
        return px >= x && px < x + width && py >= y && py < y + height;
    }

    void render(Surface s) {
        Sprite sprite = hp >= 3 ? Assets.target3 : (hp == 2 ? Assets.target2 : Assets.target1);
        s.blitAlpha(sprite, x, y);
    }
}

/** Expanding clipped ring, purely decorative, short-lived. */
class Shockwave extends Entity {
    int radius;
    int maxRadius;
    int life;
    int maxLife;

    Shockwave(ParticleFountain game) {
        super(game);
        alive = false;
    }

    void start(int cx, int cy, int maxR, int lifeFrames) {
        x = cx;
        y = cy;
        radius = 2;
        maxRadius = maxR;
        life = lifeFrames;
        maxLife = lifeFrames;
        alive = true;
    }

    void step(int dt) {
        radius = maxRadius * (maxLife - life) / maxLife + 2;
        life--;
        if (life <= 0) {
            alive = false;
        }
    }

    void render(Surface s) {
        int alpha = 200 * life / maxLife;
        int segs = 20;
        for (int i = 0; i < segs; i++) {
            double a = i * 6.2831853 / segs;
            int px = x + (int) (Math.cos(a) * radius);
            int py = y + (int) (Math.sin(a) * radius);
            s.plotAdd(px, py, 0xBFE8FF, alpha);
        }
    }
}

/** Deterministic timeline driving everything that would otherwise be input. */
class Script {
    final ParticleFountain game;
    int t;             // global timeline in ms
    int burstCountdown;
    int waveCountdown;
    int megaCountdown;
    int targetRespawnCountdown;
    int megaPhase;

    Script(ParticleFountain game) {
        this.game = game;
        burstCountdown = 30;
        waveCountdown = 300;
        megaCountdown = 1500;
        targetRespawnCountdown = 60;
    }

    void step(int dt) {
        t += dt;

        // keep at least three targets alive, spawning at seeded positions
        targetRespawnCountdown -= dt;
        if (targetRespawnCountdown <= 0) {
            targetRespawnCountdown = 220;
            int aliveCount = 0;
            for (int i = 0; i < ParticleFountain.MAX_TARGETS; i++) {
                Target tt = game.targets[i];
                if (tt != null && tt.alive) {
                    aliveCount++;
                }
            }
            if (aliveCount < 3) {
                for (int i = 0; i < ParticleFountain.MAX_TARGETS; i++) {
                    Target tt = game.targets[i];
                    if (tt == null) {
                        tt = new Target(game);
                        game.targets[i] = tt;
                    }
                    if (!tt.alive) {
                        int tx = 24 + game.rng.nextInt(ParticleFountain.W - 70);
                        int ty = ParticleFountain.VIEW_Y + 14
                                + game.rng.nextInt(ParticleFountain.VIEW_H / 2);
                        tt.startAt(tx, ty);
                        break;
                    }
                }
            }
        }

        // mega burst: fountain salvo + shockwave + chord, alternating pitch
        megaCountdown -= dt;
        if (megaCountdown <= 0) {
            megaCountdown = 2100;
            megaPhase++;
            game.fountain.burst(40, 170, 230);
            game.spawnWave(game.paddle.x + Paddle.PW / 2, game.paddle.y - 6, 60, 34);
            game.sound.mega(megaPhase);
        }
    }

    int nextBurstDelay() {
        // deterministic rhythm with a slow morph; seeded rng only for jitter
        int base = 55 + (t / 2400 % 4) * 25;
        return base + game.rng.nextInt(30);
    }

    int nextBurstCount() {
        return 4 + game.rng.nextInt(5);
    }
}

// ============================================================================
// Software rasterizer over the shared int[] framebuffer. All clipping and all
// blending happens here, per pixel, on packed ARGB ints.
// ============================================================================

final class Surface {
    final int[] pixels;
    final int width;
    final int height;

    private int clipX0;
    private int clipY0;
    private int clipX1;
    private int clipY1;

    Surface(int w, int h) {
        width = w;
        height = h;
        pixels = new int[w * h];
        resetClip();
    }

    void resetClip() {
        clipX0 = 0;
        clipY0 = 0;
        clipX1 = width;
        clipY1 = height;
    }

    void clip(int x, int y, int w, int h) {
        int x0 = x;
        int y0 = y;
        int x1 = x + w;
        int y1 = y + h;
        if (x0 < clipX0) {
            x0 = clipX0;
        }
        if (y0 < clipY0) {
            y0 = clipY0;
        }
        if (x1 > clipX1) {
            x1 = clipX1;
        }
        if (y1 > clipY1) {
            y1 = clipY1;
        }
        if (x1 < x0) {
            x1 = x0;
        }
        if (y1 < y0) {
            y1 = y0;
        }
        clipX0 = x0;
        clipY0 = y0;
        clipX1 = x1;
        clipY1 = y1;
    }

    void fill(int x, int y, int w, int h, int argb) {
        int x0 = x < clipX0 ? clipX0 : x;
        int y0 = y < clipY0 ? clipY0 : y;
        int x1 = x + w > clipX1 ? clipX1 : x + w;
        int y1 = y + h > clipY1 ? clipY1 : y + h;
        for (int yy = y0; yy < y1; yy++) {
            int row = yy * width;
            for (int xx = x0; xx < x1; xx++) {
                pixels[row + xx] = argb;
            }
        }
    }

    void hline(int x0, int x1, int y, int argb) {
        if (y < clipY0 || y >= clipY1) {
            return;
        }
        int a = x0 < clipX0 ? clipX0 : x0;
        int b = x1 >= clipX1 ? clipX1 - 1 : x1;
        int row = y * width;
        for (int x = a; x <= b; x++) {
            pixels[row + x] = argb;
        }
    }

    /** Replaces the framebuffer with a pre-rendered background of equal size. */
    void blitBackground(int[] bg, int w, int h) {
        System.arraycopy(bg, 0, pixels, 0, w * h);
    }

    /** Single pixel, additive: adds scaled rgb onto the destination. */
    void plotAdd(int x, int y, int rgb, int alpha) {
        if (x < clipX0 || x >= clipX1 || y < clipY0 || y >= clipY1) {
            return;
        }
        if (alpha <= 0) {
            return;
        }
        if (alpha > 256) {
            alpha = 256;
        }
        int idx = y * width + x;
        int dst = pixels[idx];
        int sr = (rgb >> 16 & 255) * alpha >> 8;
        int sg = (rgb >> 8 & 255) * alpha >> 8;
        int sb = (rgb & 255) * alpha >> 8;
        int dr = (dst >> 16 & 255) + sr;
        int dg = (dst >> 8 & 255) + sg;
        int db = (dst & 255) + sb;
        if (dr > 255) {
            dr = 255;
        }
        if (dg > 255) {
            dg = 255;
        }
        if (db > 255) {
            db = 255;
        }
        pixels[idx] = 0xFF000000 | dr << 16 | dg << 8 | db;
    }

    /** Alpha-over blit: standard per-pixel transparency compositing. */
    void blitAlpha(Sprite sprite, int dx, int dy) {
        int[] px = sprite.pixels;
        int sw = sprite.width;
        int sh = sprite.height;
        int x0 = dx < clipX0 ? clipX0 - dx : 0;
        int y0 = dy < clipY0 ? clipY0 - dy : 0;
        int x1 = dx + sw > clipX1 ? clipX1 - dx : sw;
        int y1 = dy + sh > clipY1 ? clipY1 - dy : sh;
        for (int y = y0; y < y1; y++) {
            int row = (dy + y) * width + dx;
            int srow = y * sw;
            for (int x = x0; x < x1; x++) {
                int argb = px[srow + x];
                int a = argb >>> 24;
                if (a >= 254) {
                    pixels[row + x] = argb | 0xFF000000;
                } else if (a > 0) {
                    int dst = pixels[row + x];
                    int ir = 255 - a;
                    int nr = ((argb >> 16 & 255) * a + (dst >> 16 & 255) * ir) / 255;
                    int ng = ((argb >> 8 & 255) * a + (dst >> 8 & 255) * ir) / 255;
                    int nb = ((argb & 255) * a + (dst & 255) * ir) / 255;
                    pixels[row + x] = 0xFF000000 | nr << 16 | ng << 8 | nb;
                }
            }
        }
    }

    /** Additive tinted blit: the glow path used by particles and flares. */
    void blitAddTinted(Sprite sprite, int dx, int dy, int tint, int alpha) {
        if (alpha <= 0) {
            return;
        }
        if (alpha > 256) {
            alpha = 256;
        }
        int tr = tint >> 16 & 255;
        int tg = tint >> 8 & 255;
        int tb = tint & 255;
        int[] px = sprite.pixels;
        int sw = sprite.width;
        int sh = sprite.height;
        int x0 = dx < clipX0 ? clipX0 - dx : 0;
        int y0 = dy < clipY0 ? clipY0 - dy : 0;
        int x1 = dx + sw > clipX1 ? clipX1 - dx : sw;
        int y1 = dy + sh > clipY1 ? clipY1 - dy : sh;
        for (int y = y0; y < y1; y++) {
            int row = (dy + y) * width + dx;
            int srow = y * sw;
            for (int x = x0; x < x1; x++) {
                int argb = px[srow + x];
                int a = (argb >>> 24) * alpha >> 8;
                if (a > 0) {
                    int idx = row + x;
                    int dst = pixels[idx];
                    int sr = ((argb >> 16 & 255) * tr >> 8) * a >> 8;
                    int sg = ((argb >> 8 & 255) * tg >> 8) * a >> 8;
                    int sb = ((argb & 255) * tb >> 8) * a >> 8;
                    int dr = (dst >> 16 & 255) + sr;
                    int dg = (dst >> 8 & 255) + sg;
                    int db = (dst & 255) + sb;
                    if (dr > 255) {
                        dr = 255;
                    }
                    if (dg > 255) {
                        dg = 255;
                    }
                    if (db > 255) {
                        db = 255;
                    }
                    pixels[idx] = 0xFF000000 | dr << 16 | dg << 8 | db;
                }
            }
        }
    }

    /** 3x5 bitmap font text, alpha-over. */
    void text(String s, int dx, int dy, int rgb) {
        int cx = dx;
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            int glyph = Assets.glyph(c);
            drawGlyph(glyph, cx, dy, rgb);
            cx += 4;
        }
    }

    void drawGlyph(int glyph, int dx, int dy, int rgb) {
        if (glyph == 0) {
            return;
        }
        for (int row = 0; row < 5; row++) {
            int bits = glyph >> (12 - row * 3) & 7;
            for (int col = 0; col < 3; col++) {
                if ((bits >> (2 - col) & 1) != 0) {
                    int px = dx + col;
                    int py = dy + row;
                    if (px >= clipX0 && px < clipX1 && py >= clipY0 && py < clipY1) {
                        pixels[py * width + px] = rgb | 0xFF000000;
                    }
                }
            }
        }
    }

    /** Right-aligned decimal without touching java.lang.String. */
    void drawInt(int value, int rightX, int dy, int rgb, int maxDigits) {
        if (value < 0) {
            value = -value;
        }
        int count = 1;
        int v = value;
        while (v >= 10 && count < maxDigits) {
            v /= 10;
            count++;
        }
        int div = 1;
        for (int i = 1; i < count; i++) {
            div *= 10;
        }
        int x = rightX - (count - 1) * 4;
        for (int i = 0; i < count; i++) {
            int digit = value / div % 10;
            div /= 10;
            char c = (char) ('0' + digit);
            int glyph = Assets.glyph(c);
            drawGlyph(glyph, x, dy, rgb);
            x += 4;
        }
    }

    void drawHex(int value, int rightX, int dy, int rgb) {
        int x = rightX;
        for (int i = 0; i < 8; i++) {
            int nib = value >>> (i * 4) & 15;
            int ch = nib < 10 ? '0' + nib : 'A' + nib - 10;
            int glyph = Assets.glyph((char) ch);
            drawGlyph(glyph, x - 3, dy, rgb);
            x -= 4;
        }
    }
}

/** Simple packed-ARGB sprite. */
class Sprite {
    final int width;
    final int height;
    final int[] pixels;

    Sprite(int w, int h) {
        width = w;
        height = h;
        pixels = new int[w * h];
    }
}

/** xorshift32: the single deterministic randomness source of the whole game. */
class Rng {
    int s;

    Rng(int seed) {
        s = seed == 0 ? 0x9E3779B9 : seed;
    }

    int next() {
        int x = s;
        x ^= x << 13;
        x ^= x >>> 17;
        x ^= x << 5;
        s = x;
        return x;
    }

    int nextInt(int bound) {
        if (bound <= 0) {
            return 0;
        }
        int r = next();
        return (r >>> 1) % bound;
    }

    int between(int lo, int hi) {
        if (hi <= lo) {
            return lo;
        }
        int n = nextInt(hi - lo + 1);
        return lo + n;
    }
}

// ============================================================================
// Generated audio: a small polyphonic synth whose per-frame PCM output is a
// "sample framebuffer" - filled frame by frame, then pumped into the
// javax.sound.sampled SourceDataLine with real backpressure.
// ============================================================================

final class SoundChip {
    static final int RATE = 22050;
    static final int MAX_SAMPLES = 2048;
    static final int VOICES = 8;

    // voice state, one flat int array, reused forever (no allocation)
    // voice v occupies slots [v*8 .. v*8+7]:
    //   [mode, phase, freqStep, env, decay, seed, sweep, spare]
    private final int[] voices = new int[VOICES * 8];

    private final int[] mix = new int[MAX_SAMPLES];
    private final byte[] pcm = new byte[MAX_SAMPLES * 2];

    SourceDataLine line;
    boolean ready;
    private int noiseState;

    /** Modes. */
    static final int OFF = 0;
    static final int SQUARE = 1;
    static final int NOISE = 2;
    static final int SWEEP = 3;

    void open() {
        try {
            // NOTE: the minimal frontend resolves inner-class member syntax
            // only in fully-qualified form (mirrors the FunOrb clients, e.g.
            // geoblox/ce.java which spells javax.sound.sampled.DataLine.Info).
            javax.sound.sampled.AudioFormat format =
                    new javax.sound.sampled.AudioFormat(22050.0f, 16, 1, true, false);
            javax.sound.sampled.DataLine.Info info =
                    new javax.sound.sampled.DataLine.Info(SourceDataLine.class, format);
            line = (SourceDataLine) AudioSystem.getLine(info);
            line.open(format, 8192);
            line.start();
            ready = true;
        } catch (LineUnavailableException e) {
            ready = false;
        } catch (RuntimeException e) {
            ready = false;
        } catch (Error e) {
            ready = false; // e.g. missing JRE overload on exotic builds
        }
        noiseState = 0x1234ABCD;
    }

    void blip(int freq, int decayPerSample, int volume) {
        int v = findVoice() * 8;
        voices[v] = SQUARE;
        voices[v + 1] = 0;
        voices[v + 2] = freqStep(freq);
        voices[v + 3] = volume * 64;
        voices[v + 4] = decayPerSample;
    }

    void tick() {
        blip(1400, 500, 30);
    }

    void hit() {
        noiseBurst(70, 900);
        blip(330, 90, 70);
    }

    void chord() {
        blip(523, 26, 80);
        blip(659, 26, 70);
        blip(784, 26, 70);
        noiseBurst(50, 1400);
    }

    void mega(int phase) {
        int base = phase % 2 == 0 ? 392 : 440;
        blip(base, 14, 90);
        blip(base * 3 / 2, 14, 80);
        blip(base * 2, 14, 80);
        noiseBurst(120, 2600);
    }

    private void noiseBurst(int volume, int decay) {
        int v = findVoice() * 8;
        voices[v] = NOISE;
        voices[v + 1] = 0;
        voices[v + 2] = 0;
        voices[v + 3] = volume * 64;
        voices[v + 4] = decay;
    }

    private int findVoice() {
        int quietest = 0;
        int quietValue = Integer.MAX_VALUE;
        for (int i = 0; i < VOICES; i++) {
            int env = voices[i * 8 + 3];
            if (voices[i * 8] == OFF) {
                return i;
            }
            if (env < quietValue) {
                quietValue = env;
                quietest = i;
            }
        }
        return quietest; // steal the quietest voice
    }

    private int freqStep(int freq) {
        return freq * 65536 / RATE;
    }

    /** Synthesizes one frame-window of samples and writes them to the line. */
    void pump(int dtMs) {
        if (!ready) {
            return;
        }
        int need = RATE * dtMs / 1000;
        if (need < 16) {
            need = 16;
        }
        if (need > MAX_SAMPLES) {
            need = MAX_SAMPLES;
        }

        for (int i = 0; i < need; i++) {
            int total = 0;
            for (int v = 0; v < VOICES; v++) {
                int base = v * 8;
                int mode = voices[base];
                if (mode == OFF) {
                    continue;
                }
                int sample = 0;
                if (mode == SQUARE) {
                    sample = (voices[base + 1] & 0x8000) != 0 ? 400 : -400;
                    voices[base + 1] += voices[base + 2];
                } else if (mode == NOISE) {
                    noiseState ^= noiseState << 13;
                    noiseState ^= noiseState >>> 17;
                    noiseState ^= noiseState << 5;
                    sample = (noiseState >> 16) % 400;
                } else if (mode == SWEEP) {
                    sample = (voices[base + 1] & 0x8000) != 0 ? 400 : -400;
                    voices[base + 1] += voices[base + 2];
                    voices[base + 2] = voices[base + 2] * 999 / 1000;
                }
                int env = voices[base + 3];
                sample = sample * env >> 12;
                total += sample;
                env -= voices[base + 4];
                if (env <= 0) {
                    voices[base] = OFF;
                    voices[base + 3] = 0;
                } else {
                    voices[base + 3] = env;
                }
            }
            if (total > 3200) {
                total = 3200;
            }
            if (total < -3200) {
                total = -3200;
            }
            mix[i] = total;
        }

        // int mono -> 16-bit little-endian bytes
        for (int i = 0; i < need; i++) {
            int s = mix[i];
            pcm[i * 2] = (byte) s;
            pcm[i * 2 + 1] = (byte) (s >> 8);
        }

        int byteCount = need * 2;
        // Backpressure: write only what the line can absorb, like the
        // FunOrb clients reading SourceDataLine.available().
        int cap = line.available();
        int n = cap < byteCount ? cap : byteCount;
        if (n > 0) {
            line.write(pcm, 0, n);
        }
    }

    void close() {
        if (line != null) {
            line.close();
            ready = false;
        }
    }
}

// ============================================================================
// Fixed-seed procedural assets: sprites, background, bitmap font, marquee.
// Everything is generated once from the seed; nothing is loaded.
// ============================================================================

final class Assets {
    static Sprite glow;
    static Sprite paddle;
    static Sprite target1;
    static Sprite target2;
    static Sprite target3;
    static int[] background;

    static final int TWINKLES = 28;
    static int[] twinkleData;   // packed: x:12 | y:12 | phase:8
    static int[] font = new int[96];

    static String marquee;
    static int MARQUEE_LEN;
    static String SCORE_TEXT;
    static String HITS_TEXT;
    static String FPS_TEXT;

    private static boolean built;

    private Assets() {
    }

    static void twinklePut(int i, int x, int y, int phase) {
        twinkleData[i] = (x << 20) | (y << 8) | (phase & 255);
    }

    static int twinkleX(int i) {
        return twinkleData[i] >>> 20;
    }

    static int twinkleY(int i) {
        return twinkleData[i] << 12 >>> 20;
    }

    static int twinklePhase(int i) {
        return twinkleData[i] & 255;
    }

    static void build(int seed) {
        if (built) {
            return;
        }
        built = true;
        Rng rng = new Rng(seed);

        buildFont();

        SCORE_TEXT = "SCORE";
        HITS_TEXT = "HITS";
        FPS_TEXT = "FPS";
        marquee = "PARTICLE FOUNTAIN  //  FIXED-SEED PROCEDURAL ASSETS  //  "
                + "SCRIPTED INPUT  //  SOFTWARE CLIPPING + ALPHA  //  "
                + "SYNTH AUDIO VIA SAMPLE BUFFER  //  ";
        MARQUEE_LEN = marquee.length();

        buildGlow();
        buildPaddle(rng);
        buildTargets();
        buildBackground(rng);
    }

    static int glyph(char c) {
        int i = c;
        if (i < 32 || i >= 128) {
            return 0;
        }
        return font[i - 32];
    }

    /** 3x5 glyph packed as five 3-bit rows, generated, not hand-drawn. */
    private static void buildFont() {
        set('0', 7, 5, 5, 5, 7);
        set('1', 2, 6, 2, 2, 7);
        set('2', 7, 1, 7, 4, 7);
        set('3', 7, 1, 3, 1, 7);
        set('4', 5, 5, 7, 1, 1);
        set('5', 7, 4, 7, 1, 7);
        set('6', 7, 4, 7, 5, 7);
        set('7', 7, 1, 1, 2, 2);
        set('8', 7, 5, 7, 5, 7);
        set('9', 7, 5, 7, 1, 7);
        set('A', 2, 5, 7, 5, 5);
        set('B', 6, 5, 6, 5, 6);
        set('C', 3, 4, 4, 4, 3);
        set('D', 6, 5, 5, 5, 6);
        set('E', 7, 4, 6, 4, 7);
        set('F', 7, 4, 6, 4, 4);
        set('G', 7, 4, 5, 5, 7);
        set('H', 5, 5, 7, 5, 5);
        set('I', 7, 2, 2, 2, 7);
        set('J', 1, 1, 1, 5, 7);
        set('K', 5, 5, 6, 5, 5);
        set('L', 4, 4, 4, 4, 7);
        set('M', 5, 7, 5, 5, 5);
        set('N', 6, 5, 5, 5, 5);
        set('O', 7, 5, 5, 5, 7);
        set('P', 7, 5, 7, 4, 4);
        set('Q', 7, 5, 5, 7, 1);
        set('R', 7, 5, 6, 5, 5);
        set('S', 3, 4, 2, 1, 6);
        set('T', 7, 2, 2, 2, 2);
        set('U', 5, 5, 5, 5, 7);
        set('V', 5, 5, 5, 5, 2);
        set('W', 5, 5, 5, 7, 5);
        set('X', 5, 5, 2, 5, 5);
        set('Y', 5, 5, 2, 2, 2);
        set('Z', 7, 1, 2, 4, 7);
        set(' ', 0, 0, 0, 0, 0);
        set('-', 0, 0, 7, 0, 0);
        set('+', 0, 2, 7, 2, 0);
        set('.', 0, 0, 0, 0, 2);
        set(':', 0, 2, 0, 2, 0);
        set('/', 1, 1, 2, 4, 4);
        set('*', 5, 2, 7, 2, 5);
    }

    private static void set(char c, int r0, int r1, int r2, int r3, int r4) {
        font[c - 32] = r0 << 12 | r1 << 9 | r2 << 6 | r3 << 3 | r4;
    }

    private static void buildGlow() {
        glow = new Sprite(9, 9);
        for (int y = 0; y < 9; y++) {
            for (int x = 0; x < 9; x++) {
                int ddx = x - 4;
                int ddy = y - 4;
                int d2 = ddx * ddx + ddy * ddy;
                int a = 255 - d2 * 255 / 20;
                if (a < 0) {
                    a = 0;
                }
                glow.pixels[y * 9 + x] = a << 24 | 0xFFFFFF;
            }
        }
    }

    private static void buildPaddle(Rng rng) {
        paddle = new Sprite(44, 8);
        for (int y = 0; y < 8; y++) {
            for (int x = 0; x < 44; x++) {
                int argb;
                boolean rim = y == 0 || y == 7 || x == 0 || x == 43;
                if (rim) {
                    argb = 0xFFE8F4FF;
                } else {
                    // vertical gradient + seeded dither sparkle, slightly
                    // translucent so the alpha-over path really blends
                    int base = 210 - y * 14;
                    int dither = rng.nextInt(24) - 12;
                    int v = base + dither;
                    if (v < 0) {
                        v = 0;
                    }
                    if (v > 255) {
                        v = 255;
                    }
                    argb = 0xE8000000 | v << 16 | (v * 3 / 4) << 8 | (v / 2);
                }
                paddle.pixels[y * 44 + x] = argb;
            }
        }
    }

    private static void buildTargets() {
        target1 = buildTarget(0xFFB04A3A, 120);
        target2 = buildTarget(0xFFC77F3B, 160);
        target3 = buildTarget(0xFF4AC77F, 210);
    }

    private static Sprite buildTarget(int body, int brightness) {
        Sprite s = new Sprite(18, 12);
        int br = body >> 16 & 255;
        int bg = body >> 8 & 255;
        int bb = body & 255;
        for (int y = 0; y < 12; y++) {
            for (int x = 0; x < 18; x++) {
                int argb;
                boolean border = y == 0 || y == 11 || x == 0 || x == 17;
                if (border) {
                    int vr = br * brightness / 255;
                    int vg = bg * brightness / 255;
                    int vb = bb * brightness / 255;
                    argb = 0xFF000000 | vr << 16 | vg << 8 | vb;
                } else if ((x + y) % 2 == 0) {
                    // translucent body: exercises the alpha-over blend path
                    argb = 0xE0000000 | br << 16 | bg << 8 | bb;
                } else {
                    argb = 0xB0000000 | br * brightness / 255 << 16
                            | bg * brightness / 255 << 8 | bb * brightness / 255;
                }
                s.pixels[y * 18 + x] = argb;
            }
        }
        return s;
    }

    private static void buildBackground(Rng rng) {
        int w = ParticleFountain.W;
        int h = ParticleFountain.H;
        background = new int[w * h];
        for (int y = 0; y < h; y++) {
            int shade = 34 - y * 30 / h;
            for (int x = 0; x < w; x++) {
                // ordered dithering gives the retro gradient banding
                int d = ((x + y * 3) % 4);
                int v = shade + (d == 0 ? 1 : 0);
                if (v < 0) {
                    v = 0;
                }
                background[y * w + x] = 0xFF000000 | v << 16 | v / 2 << 8 | v * 3 / 4;
            }
        }
        // seeded starfield
        twinkleData = new int[TWINKLES];
        for (int i = 0; i < TWINKLES; i++) {
            int sx = 4 + rng.nextInt(w - 8);
            int sy = ParticleFountain.VIEW_Y + 4 + rng.nextInt(ParticleFountain.VIEW_H - 8);
            int phase = rng.nextInt(256);
            twinklePut(i, sx, sy, phase);
            int lum = 90 + rng.nextInt(90);
            background[sy * w + sx] = 0xFF000000 | lum << 16 | lum << 8 | lum;
        }
    }
}

