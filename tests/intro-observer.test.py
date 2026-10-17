import importlib.util
from pathlib import Path
import unittest

source = Path(__file__).resolve().parents[1] / 'apps/intro/observe-x11.py'
spec = importlib.util.spec_from_file_location('intro_observer', source)
observer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(observer)


class ObserverTest(unittest.TestCase):
    def test_binary_ids_tolerate_compositor_dimming(self):
        for identity in (0, 1, 255, 65535, 0xffffff):
            bits = observer.PREFIX + format(identity, '024b').encode() + format(identity ^ 0xffffff, '024b').encode()
            for opacity in (0.65, 0.95, 1):
                for background in (0, 0x123456, 0xffffff):
                    observed = []
                    for value in bits:
                        shade = 255 if value == 49 else 0
                        channels = [round(shade * opacity + ((background >> shift) & 255) * (1 - opacity)) for shift in (16, 8, 0)]
                        observed.append(observer.bit(channels[0] << 16 | channels[1] << 8 | channels[2]))
                    self.assertEqual(observer.decode(bytes(observed)), identity)
            damaged = bytearray(bits)
            damaged[63] ^= 1
            self.assertIsNone(observer.decode(damaged))
            self.assertIsNone(observer.decode(bits[:20] + b'?' + bits[21:]))

    def test_rolling_windows_and_stall_gap(self):
        events = [i / 4 for i in range(1, 13)]
        steady = observer.summarize(events, events, 3)
        self.assertEqual(steady['rollingOneSecondMin'], 4)
        self.assertEqual(steady['rollingOneSecondMedian'], 4)
        self.assertEqual(steady['worstFrameGapMs'], 250)
        stalled = observer.summarize([.25, .5, .75, 2.25, 2.5, 2.75, 3], events, 3)
        self.assertEqual(stalled['rollingOneSecondMin'], 0)
        self.assertEqual(stalled['worstFrameGapMs'], 1500)


if __name__ == '__main__':
    unittest.main()
