import assert from "node:assert/strict";
import test from "node:test";

import { rowsForImport } from "../lib/recipient-import.mjs";

test("uses pasted rows when Add recipients is clicked before checking the list", () => {
  const rows = rowsForImport(
    "andrew,rooney,goemeraldpathways@gmail.com,\nandrew,rooney,goemeraldpathways@gmail.com",
    [],
  );

  assert.deepEqual(rows, [
    { firstName: "andrew", lastName: "rooney", email: "goemeraldpathways@gmail.com" },
    { firstName: "andrew", lastName: "rooney", email: "goemeraldpathways@gmail.com" },
  ]);
});
