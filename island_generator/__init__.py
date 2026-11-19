bl_info = {
    "name": "FiveM Island Generator",
    "author": "Nico-du-34",
    "version": (0, 1, 0),
    "blender": (4, 2, 0),
    "location": "View3D > Sidebar > Island Gen",
    "description": "Generate procedural islands and export a FiveM-oriented asset package",
    "category": "Add Mesh",
}

import bpy
from . import addon


def register():
    addon.register()


def unregister():
    addon.unregister()
