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
from teatype.db.hsdb.core import HSDBAttribute, HSDBModel, HSDBRelation

# Local imports
from .Note import Note

class Block(HSDBModel):
    rev      = HSDBAttribute(int, required=True, description='Save timestamp (ms), changes whenever the row is written by a client')
    position = HSDBAttribute(int, required=True, description='Index of the block within its note')
    words    = HSDBAttribute(str, required=True, description='JSON array of words with their formatting')
    style    = HSDBAttribute(str, required=True, description='JSON object with the block style (border, background, ...)')
    note     = HSDBRelation.ManyToOne(Note, required=True)