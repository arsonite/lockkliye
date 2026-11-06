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

# Third-party imports
from teatype.io import env, path
from teatype.logging import log
from teatype.modulo.hsdb import hsdb

# Local imports
from server.models import Block, BlockPreset, Folder, Note, NoteHistory, Settings, Word

# Settings of .env next to this file, variables that are already set win over it
env.load(path.join(path.caller_parent(), '.env'))

DB_NAME = 'lockkliye'
MODELS = [
    Block,
    BlockPreset,
    Folder,
    Note,
    NoteHistory,
    Settings,
    Word]
PORT = int(env.get('LOCKKLIYE_PORT', 8765)) # The vite dev server proxies /hsdb to this port (vite.config.ts)
# Browser origins that may call the server directly, the browser normally goes through the vite proxy (same origin)
CORS_ORIGINS = env.get('LOCKKLIYE_CORS_ORIGINS', r'https?://(localhost|127\.0\.0\.1)(:\d+)?')

if __name__ == '__main__':
    db = hsdb.init(DB_NAME, models=MODELS, port=PORT, cors_origins=CORS_ORIGINS)
    if not db.server:
        raise SystemExit(f'"{DB_NAME}" is already hosted by another process')

    log(f'Counts: { {name: db.count(name) for name in db.models} }')
    db.server.join() # Blocks until Ctrl+C, the server lives in this process