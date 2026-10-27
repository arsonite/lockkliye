/**
 * @license
 * Copyright (C) 2024-2026 Burak Günaydin
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 */

// TeaType API
import { HSDBBaseAPI } from '@teatype/api';

// The server (lockkliye_server.py) serves the HSDB unit under /hsdb/<Model>
HSDBBaseAPI.configure({
    host: window.location.hostname,
    port: Number(import.meta.env.VITE_HSDB_PORT ?? 8765),
    endpoint: 'hsdb',
    timeout: 8000,
});

class FolderAPI extends HSDBBaseAPI {
    static resource = 'Folder';
}

class NoteAPI extends HSDBBaseAPI {
    static resource = 'Note';
}

class NoteHistoryAPI extends HSDBBaseAPI {
    static resource = 'NoteHistory';
}

class SettingsAPI extends HSDBBaseAPI {
    static resource = 'Settings';
}

export { FolderAPI, NoteAPI, NoteHistoryAPI, SettingsAPI };
