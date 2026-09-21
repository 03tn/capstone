import os
import unittest

os.environ.setdefault(
    "CALDER_TAXONOMY_PATH",
    os.path.join(os.path.dirname(__file__), "..", "src", "data", "cuad-calder-taxonomy.json"),
)

import app


class ClassifierHelpersTest(unittest.TestCase):
    def test_chunks_overlap_and_preserve_text(self):
        text = "a" * 10_000
        parts = list(app.chunks(text))
        self.assertGreater(len(parts), 1)
        self.assertEqual(len(parts[0]), 4_500)

    def test_taxonomy_has_mapped_categories(self):
        self.assertIn("Cap on Liability", app.TAXONOMY)
        self.assertIn("Governing Law", app.TAXONOMY)


if __name__ == "__main__":
    unittest.main()
