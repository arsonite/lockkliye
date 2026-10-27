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
from teatype.db.hsdb.core import HSDBAttribute, HSDBModel

# What a note looked like before a change, the undo history points to it.
# The folder is a plain id because the folder may have been deleted since.
class NoteSnapshot(HSDBModel):
    created_ms = HSDBAttribute(int,  required=True)
    folder_id  = HSDBAttribute(str,  required=True, description='Id of the folder the note was in, empty if none')
    pinned     = HSDBAttribute(bool, required=True)
    rev        = HSDBAttribute(int,  required=True, description='Save timestamp (ms), changes whenever the row is written by a client')
    title      = HSDBAttribute(str,  required=True)
    updated_ms = HSDBAttribute(int,  required=True)