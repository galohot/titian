// Copy ../data/*.json and ../schema/*.json into public/ so the site serves the downloads.
import { cpSync, mkdirSync } from 'node:fs';
mkdirSync('public/data', { recursive: true });
mkdirSync('public/schema', { recursive: true });
cpSync('../data', 'public/data', { recursive: true });
cpSync('../schema', 'public/schema', { recursive: true });
