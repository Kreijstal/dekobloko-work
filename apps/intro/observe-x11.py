#!/usr/bin/env python3
"""Count intro frame IDs visible in the X11 root, without saving images.

This observes desktop pixels, not render calls or physical-panel scanout.
The black/white ID strip tolerates inactive-window dimming; obscured or
ambiguous markers invalidate the observation.
"""
import argparse
import bisect
import ctypes as c
from ctypes.util import find_library
import json
import statistics
import time

PREFIX = b'1101010110100011'


def bit(pixel):
    channels = [pixel >> shift & 255 for shift in (16, 8, 0)]
    return 48 if max(channels) <= 96 else 49 if min(channels) >= 160 else 63


def decode(bits):
    if len(bits) != 64 or bits[:16] != PREFIX or any(value not in (48, 49) for value in bits):
        return None
    identity = int(bits[16:40], 2)
    return identity if identity ^ int(bits[40:], 2) == 0xffffff else None


def summarize(events, samples, elapsed):
    def count(t):
        return bisect.bisect_right(events, t) - bisect.bisect_right(events, t - 1)
    boundaries = [1, elapsed]
    boundaries += [t + 1 for t in events if t + 1 <= elapsed]
    boundaries += [t - 1e-8 for t in events if t - 1e-8 >= 1]
    rolling = [count(t) for t in samples if t >= 1]
    gaps = [b - a for a, b in zip([0] + events, events + [elapsed])]
    return dict(frames=len(events), averageFps=len(events) / elapsed,
                rollingOneSecondMin=min(map(count, boundaries)),
                rollingOneSecondMedian=statistics.median(rolling),
                worstFrameGapMs=max(gaps) * 1000)


class XImage(c.Structure):
    _fields_ = [(name, kind) for name, kind in [
        ('width', c.c_int), ('height', c.c_int), ('xoffset', c.c_int),
        ('format', c.c_int), ('data', c.c_void_p), ('byte_order', c.c_int),
        ('bitmap_unit', c.c_int), ('bitmap_bit_order', c.c_int),
        ('bitmap_pad', c.c_int), ('depth', c.c_int),
        ('bytes_per_line', c.c_int), ('bits_per_pixel', c.c_int),
    ]]


def observe(seconds):
    xlib = c.CDLL(find_library('X11'))

    def bind(name, result, *parameters):
        method = getattr(xlib, name)
        method.restype, method.argtypes = result, parameters
        return method

    open_display = bind('XOpenDisplay', c.c_void_p, c.c_char_p)
    root_window = bind('XDefaultRootWindow', c.c_ulong, c.c_void_p)
    width = bind('XDisplayWidth', c.c_int, c.c_void_p, c.c_int)
    height = bind('XDisplayHeight', c.c_int, c.c_void_p, c.c_int)
    get_image = bind('XGetImage', c.POINTER(XImage), c.c_void_p, c.c_ulong,
                     c.c_int, c.c_int, c.c_uint, c.c_uint, c.c_ulong, c.c_int)
    get_pixel = bind('XGetPixel', c.c_ulong, c.POINTER(XImage), c.c_int, c.c_int)
    destroy_image = bind('XDestroyImage', c.c_int, c.POINTER(XImage))
    close_display = bind('XCloseDisplay', c.c_int, c.c_void_p)
    display = open_display(None)
    if not display:
        raise RuntimeError('An active X11 DISPLAY is required')
    root = root_window(display)

    def capture(x, y, w, h):
        image = get_image(display, root, x, y, w, h, c.c_ulong(-1).value, 2)
        if not image:
            raise RuntimeError('Cannot read X11 root image')
        return image

    try:
        image = capture(0, 0, width(display, 0), height(display, 0))
        try:
            info = image.contents
            if info.bits_per_pixel != 32 or info.depth != 24:
                raise RuntimeError('The observer requires a 24-bit RGB X11 root with 32-bit storage')
            raw = c.string_at(info.data, info.bytes_per_line * info.height)
            order = 'little' if info.byte_order == 0 else 'big'
            # Discovery is outside the timed interval. Sample only 64 pixels
            # per observation once the unique marker has been located.
            locations = []
            for y in range(info.height):
                row = raw[y * info.bytes_per_line:y * info.bytes_per_line + info.width * 4]
                bits = bytes(bit(int.from_bytes(row[i:i + 4], order)) for i in range(0, len(row), 4))
                position = 0
                while True:
                    position = bits.find(PREFIX, position)
                    if position < 0:
                        break
                    if decode(bits[position:position + 64]) is not None:
                        locations.append((position, y))
                    position += 1
            if len(locations) != 1:
                raise RuntimeError('Expected one visible --measure intro marker; found ' + str(locations))
            x, y = locations[0]
        finally:
            destroy_image(image)

        started = next_sample = time.monotonic()
        events, samples, costs = [], [], []
        previous = None
        lost = skipped = 0
        while time.monotonic() - started < seconds:
            before = time.monotonic()
            image = capture(x, y, 64, 1)
            try:
                identity = decode(bytes(bit(get_pixel(image, i, 0)) for i in range(64)))
            finally:
                destroy_image(image)
            now = time.monotonic()
            samples.append(now - started)
            costs.append((now - before) * 1000)
            if identity is None:
                lost += 1
            elif identity != previous:
                if previous is not None:
                    skipped += max(0, ((identity - previous) & 0xffffff) - 1)
                previous = identity
                events.append(now - started)
            next_sample += 1 / 120
            if next_sample > now:
                time.sleep(next_sample - now)
            elif now - next_sample > 0.1:
                next_sample = now
        elapsed = time.monotonic() - started
        # The first ID predates observation; it is not a new visible frame.
        events = events[1:]
        return dict(observer='X11 root pixels at 120 Hz; not physical-panel telemetry',
                    seconds=elapsed, **summarize(events, samples, elapsed),
                    unseenSubmittedIds=skipped, obscuredSamples=lost,
                    sampleCount=len(samples), maximumCaptureMs=max(costs),
                    markerPosition=[x, y], valid=not lost and len(events) > 0)
    finally:
        close_display(display)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--seconds', type=float, default=30)
    args = parser.parse_args()
    if args.seconds < 2:
        parser.error('Observe at least two seconds')
    report = observe(args.seconds)
    print(json.dumps(report, indent=2))
    if not report['valid']:
        raise SystemExit(1)
