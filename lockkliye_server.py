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
from teatype.logging import log
from teatype.modulo.hsdb import hsdb

# Local imports
from server.models import Block, BlockPreset, Folder, Note, NoteHistory, Settings, Word

DB_NAME = 'lockkliye'
MODELS = [Folder, Note, Settings, Block, Word, BlockPreset, NoteHistory]
PORT = int(os.environ.get('LOCKKLIYE_PORT', 8765)) # The client reads the same port from VITE_HSDB_PORT
# Browser origins that may call the server, the default allows the Vite dev server on this machine only
CORS_ORIGINS = os.environ.get('LOCKKLIYE_CORS_ORIGINS', r'https?://(localhost|127\.0\.0\.1)(:\d+)?')
# Entries are written to <DATA_PATH>/hsdb/<DB_NAME>/ and restored from there on start, keep it out of dist/ which vite wipes
DATA_PATH = Path(__file__).resolve().parent.parent / '_data'

if __name__ == '__main__':
    db = hsdb.init(DB_NAME, models=MODELS, port=PORT, root_path=str(DATA_PATH), cors_origins=CORS_ORIGINS)
    if not db.server:
        raise SystemExit(f'"{DB_NAME}" is already hosted by another process')

    log(f'Counts: { {name: db.count(name) for name in db.models} }')
    db.server.join() # Blocks until Ctrl+C, the server lives in this process
