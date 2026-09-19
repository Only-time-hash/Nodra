import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const migrationsDirectory = path.resolve("supabase/migrations");
const files = (await readdir(migrationsDirectory))
  .filter((file) => file.endsWith(".sql"))
  .sort();

if (files.length === 0) {
  throw new Error("No Supabase migrations found");
}

const filenamePattern = /^(\d{14})_[a-z0-9_]+\.sql$/;
const versions = new Set();

for (const file of files) {
  const match = filenamePattern.exec(file);
  if (!match) {
    throw new Error(`Invalid migration filename: ${file}`);
  }

  const version = match[1];
  if (versions.has(version)) {
    throw new Error(`Duplicate migration version: ${version}`);
  }
  versions.add(version);

  const sql = await readFile(path.join(migrationsDirectory, file), "utf8");
  if (!sql.trim()) {
    throw new Error(`Empty migration: ${file}`);
  }
}

console.log(`Verified ${files.length} ordered Supabase migrations (${files.at(0)} → ${files.at(-1)})`);
