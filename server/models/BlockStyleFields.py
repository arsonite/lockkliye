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

# Columns of a block style, shared by Block and BlockPreset. Empty strings and -1 stand for "not set".
class BlockStyleFields(HSDBModel):
    background_color    = HSDBAttribute(str,  required=True)
    background_gradient = HSDBAttribute(str,  required=True)
    border_color        = HSDBAttribute(str,  required=True)
    border_radius       = HSDBAttribute(int,  required=True)
    border_style        = HSDBAttribute(str,  required=True, description='solid, dashed, dotted, double, none or empty')
    custom_color        = HSDBAttribute(str,  required=True)
    custom_gradient     = HSDBAttribute(str,  required=True)
    title               = HSDBAttribute(str,  required=True, description='Legend shown on the block, also the name of a preset')
    transparent         = HSDBAttribute(bool, required=True)
    width_percent       = HSDBAttribute(int,  required=True)