"""Export original miniatures for Betrayal's existing monster definitions."""
from math import cos, pi, sin
from pathlib import Path
import sys

import bmesh
import bpy
from mathutils import Vector


OUTPUT = Path(__file__).resolve().parents[2] / "public" / "betrayal-models"
OUTPUT.mkdir(exist_ok=True)


def material(name, color, roughness=.8, metallic=0):
    value = bpy.data.materials.new(name)
    value.use_nodes = True
    node = next(n for n in value.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    node.inputs["Base Color"].default_value = (*color, 1)
    node.inputs["Roughness"].default_value = roughness
    node.inputs["Metallic"].default_value = metallic
    return value


def finish(obj, name, paint, smooth=True):
    obj.name = name
    obj.data.materials.append(paint)
    for polygon in obj.data.polygons:
        polygon.use_smooth = smooth
    return obj


def ellipsoid(name, position, scale, paint, tilt=0, facets=False):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=10, location=position)
    obj = bpy.context.object
    obj.scale = scale
    obj.rotation_euler.x = tilt
    return finish(obj, name, paint, not facets)


def block(name, position, scale, paint, bevel=.015):
    bpy.ops.mesh.primitive_cube_add(size=1, location=position)
    obj = bpy.context.object
    obj.dimensions = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    rounded = obj.modifiers.new("Soft cast edges", "BEVEL")
    rounded.width = bevel
    rounded.segments = 2
    return finish(obj, name, paint, False)


def taper(name, sections, paint, facets=False, side_count=12):
    """Follow an articulated centerline with rounded or deliberately faceted cross sections."""
    points = [Vector(position) for position, _, _ in sections]
    vertices = []
    faces = []
    for i, (_, width, depth) in enumerate(sections):
        axis = (points[min(i + 1, len(points) - 1)] - points[max(i - 1, 0)]).normalized()
        reference = Vector((0, 1, 0)) if abs(axis.y) < .92 else Vector((1, 0, 0))
        across = reference.cross(axis).normalized()
        front = axis.cross(across).normalized()
        for side in range(side_count):
            angle = 2 * pi * side / side_count
            vertices.append(points[i] + cos(angle) * width * across + sin(angle) * depth * front)
        if i:
            for side in range(side_count):
                a = (i - 1) * side_count + side
                b = (i - 1) * side_count + (side + 1) % side_count
                faces.append((a, b, b + side_count, a + side_count))
    faces.extend((tuple(reversed(range(side_count))), tuple(range(len(vertices) - side_count, len(vertices)))))
    data = bpy.data.meshes.new(name)
    data.from_pydata(vertices, [], faces)
    data.update()
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    return finish(obj, name, paint, not facets)


def spectral(kind):
    jack = kind == "crimson-jack-spirit"
    photographer = kind == "magic-camera-phantom-photographer"
    cloak = material("Spectral mantle", (.24, .028, .035) if jack else (.105, .25, .19))
    edge = material("Lit folds", (.47, .075, .04) if jack else (.22, .42, .32))
    skin = material("Pale spectral face", (.57, .25, .17) if jack else (.36, .51, .36))
    shadow = material("Sunken features", (.013, .011, .014))
    eye = material("Dead eyes", (.79, .36, .10) if jack else (.57, .72, .45))
    taper("Curling mantle", [
        ((-.14, .08, .065), .012, .012), ((-.09, -.015, .15), .06, .05),
        ((.035, .035, .30), .14, .094), ((.04, .025, .55), .17, .12),
        ((0, .015, .73), .24, .14), ((0, .015, .83), .085, .083),
    ], cloak)
    for side in (-1, 1):
        taper("Furled edge", [
            ((side * .06, -.02, .17), .009, .009), ((side * .15, -.045, .36), .043, .025),
            ((side * .115, -.095, .55), .041, .021),
            ((side * .176, -.065, .70), .039, .04),
        ], edge)
        elbow = (side * (.30 if jack else .24), -.085, .64)
        hand = (side * (.21 if photographer else .32), -.225, .79 if jack or photographer else .60)
        taper("Spectral arm", [
            ((side * .16, .01, .75), .078, .070), (elbow, .055, .050),
            (hand, .030, .035),
        ], cloak)
        ellipsoid("Knuckles", hand, (.047, .035, .048), skin)
    ellipsoid("Head and hood", (0, .035, .935), (.133, .128, .174), cloak, -.10)
    ellipsoid("Cheekbones", (0, -.063, .925), (.099, .074, .120), skin, -.11)
    ellipsoid("Shallow brow", (0, -.096, .975), (.094, .052, .044), edge)
    ellipsoid("Nose bridge", (0, -.130, .935), (.024, .030, .040), skin)
    ellipsoid("Mouth hollow", (0, -.121, .875), (.055, .020, .019), shadow)
    for side in (-1, 1):
        ellipsoid("Eye socket", (side * .043, -.132, .958), (.033, .018, .019), shadow)
        ellipsoid("Eye", (side * .043, -.146, .959), (.016, .010, .009), eye)
    if photographer:
        brass = material("Tarnished camera brass", (.32, .19, .075), .48, .7)
        glass = material("Dark glass", (.045, .088, .11), .20, .3)
        block("Folding camera body", (0, -.225, .765), (.28, .11, .19), shadow)
        block("Lens housing", (0, -.289, .765), (.125, .055, .115), brass)
        ellipsoid("Lens glass", (0, -.320, .765), (.047, .019, .045), glass)
        block("Viewfinder", (.080, -.25, .868), (.062, .046, .033), brass)
    elif jack:
        for i in range(5):
            ellipsoid("Bared tooth", ((i - 2) * .017, -.139, .88), (.007, .006, .008), skin)


def troll_hand():
    moss = material("Weathered olive skin", (.29, .34, .12))
    ridge = material("Knuckle ridges", (.42, .43, .19))
    nails = material("Worn horn nails", (.14, .112, .049))
    wrist = material("Dark leather cuff", (.11, .060, .029))
    ellipsoid("Arched hand", (0, .048, .24), (.22, .25, .124), moss, -.30)
    ellipsoid("Wrist", (.016, .24, .255), (.15, .16, .117), moss, .34)
    ellipsoid("Worn binding", (.016, .35, .257), (.152, .085, .12), wrist)
    for i, (x, reach) in enumerate(zip((-.161, -.066, .034, .127), (.31, .42, .45, .36))):
        splay = (i - 1.5) * .027
        tip = (x + splay, -reach, .053)
        taper("Bent finger", [
            ((x, -.07, .254), .062, .064), ((x, -.196, .242), .058, .055),
            ((x + splay, -reach * .84, .129), .044, .045), (tip, .030, .028),
        ], moss)
        ellipsoid("Raised knuckle", (x, -.181, .280), (.049, .061, .026), ridge)
        ellipsoid("Finger nail", (tip[0], tip[1] - .012, .071), (.034, .046, .019), nails, .45)
    taper("Thumb", [
        ((-.145, .103, .178), .081, .078), ((-.27, .024, .16), .065, .065),
        ((-.327, -.099, .045), .037, .038),
    ], moss)
    ellipsoid("Thumb nail", (-.331, -.116, .058), (.042, .056, .020), nails, .22)


def stone_cherub():
    stone = material("Weathered limestone", (.36, .37, .32))
    ivory = material("Raised stone ridges", (.47, .46, .41))
    crack = material("Deep stone cuts", (.17, .185, .16))
    ellipsoid("Stone torso", (0, 0, .52), (.175, .122, .23), stone)
    ellipsoid("Folded tunic", (0, .01, .40), (.17, .138, .16), ivory)
    for side in (-1, 1):
        taper("Carved leg", [
            ((side * .074, 0, .43), .085, .079),
            ((side * .092, -.025, .22), .064, .057),
            ((side * .083, -.022, .072), .049, .048),
        ], stone)
        ellipsoid("Carved foot", (side * .087, -.053, .055), (.064, .098, .051), stone)
        for i in range(5):
            taper("Feather", [
                ((side * .107, .107, .61), .047, .038),
                ((side * (.223 + i * .030), .155 + i * .018, .64 - i * .041), .044, .026),
                ((side * (.33 + i * .019), .207 + i * .035, .69 - i * .077), .008, .008),
            ], stone if i % 2 else ivory)
    ellipsoid("Sorrowful head", (0, -.032, .808), (.133, .111, .152), ivory, .25)
    for i in range(10):
        angle = .25 * pi + i * .15 * pi
        ellipsoid("Carved curl", (.115 * cos(angle), -.018 + .087 * sin(angle), .882),
                  (.044, .048, .059), stone)
    taper("Arm shielding the eyes", [
        ((-.128, -.008, .663), .057, .061), ((-.157, -.158, .705), .047, .049),
        ((.039, -.151, .808), .038, .040),
    ], ivory)
    taper("Lower arm", [
        ((.136, -.008, .657), .058, .061), ((.159, -.050, .510), .042, .042),
        ((.098, -.134, .445), .041, .038),
    ], stone)
    ellipsoid("Mouth recess", (0, -.130, .747), (.031, .008, .009), crack)


def humanoid(kind):
    demon = kind == "free-the-realtor-demon-realtor"
    mirror = kind == "upon-reflection-mirror-being"
    coat = material("Coat", (.14, .043, .05) if demon else (.18, .33, .41) if mirror else (.077, .105, .14),
                    .30 if mirror else .84, .78 if mirror else 0)
    accent = material("Contrast", (.59, .24, .070) if demon else (.39, .66, .78) if mirror else (.55, .55, .46),
                      .24 if mirror else .79, .60 if mirror else 0)
    skin = material("Face", (.43, .067, .036) if demon else (.26, .52, .63) if mirror else (.49, .31, .20),
                    .28 if mirror else .82, .62 if mirror else 0)
    black = material("Dark details", (.030, .019, .022))
    taper("Body", [
        ((0, 0, .41), .124, .078), ((0, 0, .54), .125, .082), ((0, 0, .73), .181, .107),
        ((0, .008, .81), .09, .077),
    ], coat, mirror, 8 if mirror else 12)
    for side in (-1, 1):
        taper("Leg", [
            ((side * .078, 0, .46), .073, .076), ((side * .093, -.010, .255), .053, .052),
            ((side * .098, -.014, .075), .047, .049),
        ], coat, mirror, 8 if mirror else 12)
        ellipsoid("Shoe", (side * .10, -.056, .051), (.064, .091, .046), black, facets=mirror)
        taper("Sleeve", [
            ((side * .142, 0, .75), .066, .067),
            ((side * .20, -.025, .58), .051, .048),
            ((side * .205, -.083, .46 if not mirror else .54), .042, .040),
        ], coat, mirror, 8 if mirror else 12)
        ellipsoid("Hand", (side * .205, -.093, .442 if not mirror else .52),
                  (.036, .036, .050), skin, facets=mirror)
    ellipsoid("Head", (0, -.012, .932), (.100, .085, .132), skin, facets=mirror)
    for side in (-1, 1):
        ellipsoid("Eyes", (side * .038, -.091, .944), (.017, .011, .009), black)
    if demon:
        for side in (-1, 1):
            taper("Swept horn", [
                ((side * .065, -.01, 1.00), .046, .041),
                ((side * .109, .009, 1.082), .029, .023),
                ((side * .125, .059, 1.128), .003, .003),
            ], accent)
        ellipsoid("Sharp nose", (0, -.097, .924), (.020, .025, .032), skin)
        block("Tie", (0, -.102, .709), (.028, .016, .141), accent, .007)
        block("Leather case", (.214, -.085, .298), (.150, .083, .232), black)
    elif mirror:
        for i in range(3):
            taper("Glass shard growth", [
                ((.12 + i * .026, .043, .63 - i * .075), .034, .018),
                ((.18 + i * .030, .012, .76 - i * .064), .003, .003),
            ], accent, True, 4)
        taper("Fracture line", [
            ((-.035, -.077, 1.032), .005, .005), ((.012, -.099, .962), .004, .004),
            ((-.019, -.093, .901), .005, .004),
        ], accent, True, 4)
    else:
        ellipsoid("Hair cap", (0, .006, .986), (.104, .095, .085), black)
        ellipsoid("Hair bun", (0, .079, .981), (.058, .063, .069), black)
        ellipsoid("Linen apron", (0, -.077, .508), (.115, .031, .196), accent)
        block("Apron bib", (0, -.097, .663), (.119, .029, .130), accent)
        key = material("Old brass", (.39, .23, .071), .42, .74)
        for i in range(3):
            block("House key", (.126 + i * .025, -.068, .429 - i * .015), (.013, .024, .099), key, .003)


MODELS = {
    "crimson-jack-spirit": spectral,
    "dust-feverish-patient": spectral,
    "magic-camera-phantom-photographer": spectral,
    "helping-hands-troll-hand": lambda _: troll_hand(),
    "blood-from-stone-stone-cherub": lambda _: stone_cherub(),
    "free-the-realtor-demon-realtor": humanoid,
    "upon-reflection-mirror-being": humanoid,
    "housekeeping-housekeeper": humanoid,
}

def export(path):
    bpy.ops.export_scene.gltf(
        filepath=str(path), export_format="GLB",
        export_apply=True, export_animations=False, export_yup=True,
    )


def trim_workbuddy_mummy(source, destination):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=source)
    mesh = next(obj for obj in bpy.context.scene.objects if obj.type == "MESH")
    bpy.context.view_layer.objects.active = mesh
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    geometry = bmesh.new()
    geometry.from_mesh(mesh.data)
    # The generated square plinth is fused below this plane. The game supplies its own base.
    bmesh.ops.bisect_plane(
        geometry, geom=[*geometry.verts, *geometry.edges, *geometry.faces],
        dist=.00001, plane_co=(0, 0, .012), plane_no=(0, 0, 1), clear_inner=True,
    )
    geometry.normal_update()
    geometry.to_mesh(mesh.data)
    geometry.free()
    export(destination)


if "--" in sys.argv:
    trim_workbuddy_mummy(*sys.argv[sys.argv.index("--") + 1:])
else:
    for key, build in MODELS.items():
        bpy.ops.wm.read_factory_settings(use_empty=True)
        build(key)
        parts = list(bpy.context.scene.objects)
        for obj in parts:
            obj.select_set(True)
        bpy.context.view_layer.objects.active = parts[0]
        bpy.ops.object.convert(target="MESH")
        bpy.ops.object.join()
        bpy.context.object.name = key
        export(OUTPUT / f"monster-{key}.glb")
