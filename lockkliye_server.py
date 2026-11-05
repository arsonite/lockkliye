# Copyright (C) 2024-2026 Burak Günaydin
#
# Permission is hereby granted, free of charge, to any person obtaining a copy
# of this software and associated documentation files (the "Software"), to deal
# in the Software without restriction, including without limitation the rights
# to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
# copies of the Software, and to permit persons to whom the Software is
# furnished to do so, subject to the following conditions:
#
# The above copyright notice and this permission notice shall be included in
# all copies or substantial portions of the Software.
# Standard-library imports
import os
from pathlib import Path

# Third-party imports
from dotenv import load_dotenv
from teatype.logging import log
from teatype.modulo.hsdb import hsdb

# Local imports
from server.models import Block, BlockPreset, Folder, Note, NoteHistory, Settings, Word

# Settings of .env next to this file, variables that are already set win over it
load_dotenv(Path(__file__).resolve().parent / '.env')

DB_NAME = 'lockkliye'
MODELS = [Folder, Note, Settings, Block, Word, BlockPreset, NoteHistory]
PORT = int(os.environ.get('LOCKKLIYE_PORT', 8765)) # The vite dev server proxies /hsdb to this port (vite.config.ts)
# Browser origins that may call the server directly, the browser normally goes through the vite proxy (same origin)
CORS_ORIGINS = os.environ.get('LOCKKLIYE_CORS_ORIGINS', r'https?://(localhost|127\.0\.0\.1)(:\d+)?')
# Entries are written to <DATA_PATH>/hsdb/<DB_NAME>/ and restored from there on start, scripts/install creates the folder
DATA_PATH = Path(os.environ.get('LOCKKLIYE_DATA_PATH', '/var/lib/lockkliye'))

if __name__ == '__main__':
    if not DATA_PATH.is_dir():
        raise SystemExit(f'Data path {DATA_PATH} does not exist, run scripts/install to create it')

    db = hsdb.init(DB_NAME, models=MODELS, port=PORT, root_path=str(DATA_PATH), cors_origins=CORS_ORIGINS)
    if not db.server:
        raise SystemExit(f'"{DB_NAME}" is already hosted by another process')

    log(f'Counts: { {name: db.count(name) for name in db.models} }')
    db.server.join() # Blocks until Ctrl+C, the server lives in this process
