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
from .Block import Block
from .Note import Note

# Empty strings stand for "not set"
class Word(HSDBModel):
    anchor        = HSDBRelation.ManyToOne(Note) # Optional, the anchor note a word opens
    block         = HSDBRelation.ManyToOne(Block, required=True)
    bold          = HSDBAttribute(bool, required=True)
    color         = HSDBAttribute(str,  required=True)
    font_size     = HSDBAttribute(str,  required=True, description='tiny, smaller, normal, large, larger, huge or empty')
    highlight     = HSDBAttribute(str,  required=True)
    italic        = HSDBAttribute(bool, required=True)
    link          = HSDBAttribute(str,  required=True)
    position      = HSDBAttribute(int,  required=True, description='Index of the word within its block')
    rev           = HSDBAttribute(int,  required=True, description='Save timestamp (ms), changes whenever the row is written by a client')
    strikethrough = HSDBAttribute(bool, required=True)
    text          = HSDBAttribute(str,  required=True)
    underline     = HSDBAttribute(bool, required=True)