# Unity Development Conventions

Use this file for all Unity work: scripts, scenes, prefabs, assets, project settings, and VR. It builds on `code-conventions-csharp.md` and wins where they overlap. Folder and assembly structure is in `architecture-unity-game.md` (which defines the `<Product>` prefix); versions, packages and target platforms are in `stack.md`.

## Project Settings (Non-Negotiable)

- Asset Serialization Mode: **Force Text**. Version Control Mode: **Visible Meta Files**.
- Every asset has its `.meta` file committed in the same commit. Never delete or regenerate a `.meta` by hand; a changed GUID breaks every reference to the asset.
- Move and rename assets **inside the Unity Editor** (or with their `.meta` together) so GUIDs survive.
- Binary assets (models, textures, audio, video, fonts) go through Git LFS.
- Configure UnityYAMLMerge (Smart Merge) as the git merge tool for `.unity`, `.prefab`, `.asset`.
- Enter Play Mode Options: domain reload **disabled** for fast iteration. Consequence: static fields are not reset between play sessions. Any static state must be reset in a `[RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.SubsystemRegistration)]` method.
- Active Input Handling: **Input System package** only. The legacy `UnityEngine.Input` API is forbidden.

## Scenes And Prefabs

- Scenes contain composition, not content. Almost everything placed in a scene is a prefab instance.
- One owner edits a scene at a time; scene merges are a last resort. Split work into prefabs to avoid scene conflicts.
- Use prefab variants for versions of the same object (per level, faction, or tier). Nested prefabs for reusable pieces.
- Gameplay and interaction components live in prefabs, never as components a scene adds to an instance. An art-only prefab that gameplay uses gets an interactive variant carrying those components; the art prefab stays free of gameplay. Scenes place prefabs and set only their pose.
- Prefab generators update an existing prefab in place (`PrefabUtility.LoadPrefabContents`, add what is missing, save), so its objects keep their ids. A generator that rebuilds a prefab from scratch renumbers its objects and breaks every scene that places it: only one builder may run it, and the scenes that place that prefab are rebuilt after it.
- A scene builder brings every prefab up to date before it builds the scene, and only places them inside it: regenerating a prefab while its scene is open resets the placed instances of it and of its variants.
- Do not break prefab connections. Do not "unpack" prefabs in scenes.
- Scene objects referencing each other: serialized references wired in the Inspector or by the composition root. Never `GameObject.Find`, `FindObjectOfType`, `FindObjectsByType`, or tag lookups at runtime.
- A `Bootstrap` scene is the only entry point in builds. Every other scene must also be runnable directly in the Editor for iteration (dev-only fallback bootstrap).

## MonoBehaviours

- MonoBehaviours are thin adapters: read input/physics, forward to Core or Interaction, reflect Core state in visuals. Game rules live in Core (plain C#).
- One responsibility per component. Prefer several small components over one large one.
- Serialized fields: `[SerializeField] private` — never `public` fields. Expose read-only properties when other code needs values.
- Use `[RequireComponent]` for hard dependencies, `[DisallowMultipleComponent]` where two instances would be a bug.
- Cache component references in `Awake`. No `GetComponent`, `Find`, or `Camera.main` in `Update`, `FixedUpdate`, or `LateUpdate`.
- Lifecycle discipline:
  - `Awake`: self-initialization and caching own components only.
  - `OnEnable` / `OnDisable`: subscribe / unsubscribe events. Always paired.
  - `Start`: logic that needs other objects initialized.
  - `OnDestroy`: release resources not covered by `OnDisable`.
- Do not rely on execution order between scripts. If order matters, initialize explicitly from the composition root; `[DefaultExecutionOrder]` only for infrastructure and documented.
- Empty `Update`/`FixedUpdate`/`LateUpdate` methods are removed; they still cost a call per frame.
- Validate serialized references in `OnValidate` (editor feedback) and fail loudly at startup if a required reference is missing.
- Renaming a serialized field requires `[FormerlySerializedAs("oldName")]`, kept until all assets are resaved.
- Use `UnityEvent` only when designers wire callbacks in the Inspector; code-to-code notifications use C# events.

## UnityEngine.Object Null Semantics

- Destroyed Unity objects compare `== null` as true but are not actually null. Therefore:
- Never use `?.`, `??`, `??=`, or `is null` / `is not null` on `UnityEngine.Object` types. Use explicit `== null` / `!= null` or `if (obj)`.
- Do not keep references to destroyed objects; clear them on destroy events.

## ScriptableObjects (Content)

- ScriptableObjects hold **authored, read-only data**: levels, items, characters, dialogue lines, tuning values.
- Never mutate a ScriptableObject at runtime. In the Editor, changes persist into the asset and corrupt content. Runtime state lives in Core objects created from definitions.
- Each definition has a stable ID field for save files and cross-references; do not rely on asset names or paths.
- Every definition type has an EditMode validation test that loads all assets of that type and checks required fields and references.
- Use `[CreateAssetMenu(menuName = "<Product>/...")]` for authoring.

## Async, Randomness, And JSON

- Prefer Unity's `Awaitable` for engine-bound async; use `Task` only for pure Core or I/O code.
- No `async void` except for Unity event handlers that must be void; wrap their bodies in try/catch with logging.
- In MonoBehaviours, pass `destroyCancellationToken` into long-running operations.
- Coroutines are acceptable for simple sequenced visuals; do not mix coroutine and async flows for the same feature.
- Gameplay randomness uses the seeded RNG from Core, passed as a dependency. Never `UnityEngine.Random` in Core.
- JSON data types read with `JsonUtility` (editor tools reading `SourceAssets/` files) are private nested `[Serializable]` classes whose public fields are named after the JSON keys, because `JsonUtility` maps by field name. They are the only exception to the C# field naming rule and the public-field ban.

## Physics

- Gameplay physics runs in `FixedUpdate`; input sampling in `Update`.
- Move `Rigidbody` objects with `MovePosition`/`MoveRotation` or forces, never by setting `transform.position` on a dynamic body.
- Thrown and falling objects: interpolation on, continuous collision detection for small fast objects. Interpolation only while physics moves a body: a body that is carried (kinematic, parented) or moved by code has it off, or the body writes its last physics pose back over each move and the object judders.
- Use layers and the collision matrix to keep interactions cheap: separate layers for the player, held objects, interaction targets, and environment.
- Triggers mark interaction zones. Trigger colliders are simple primitives.
- Keep Fixed Timestep aligned to the target display refresh rate (the headset rate in VR) once known; do not change it ad hoc.
- Non-convex `MeshCollider` only on static geometry.
- A collider that moves at runtime sits under a Rigidbody, kinematic when code moves it (a door, a lift, a platform): a moving collider without one is a static collider the physics engine rebuilds every move.
- In games where the player carries objects, the player's body never collides with what the player holds: a held object must never push the player or be stepped onto. An object let go of stays ignored by the body until the body is clear of it.
- Everything the player must reach (hand, cursor, crosshair) has a collider: a moving part of a model that its collision shape does not cover gets its own trigger.

## Input

- All input goes through Input System action assets. No device polling in gameplay code.
- Every action asset generates its C# class (importer: Generate C# Class, next to the rig that owns it). Code reaches actions through that class only: no action names as strings, no `InputActionReference` fields. One component creates the instance and shares it with the rest of its rig.
- Gameplay reacts to **Interaction layer events** (grab, release, use, action performed), never to device input directly. The rigs are the only code that reads input actions.
- When the game supports several input setups, every gameplay action is performable in each of them. A feature that works in only one is not done.
- Dev shortcuts (spawn scenario, set seed, time scale, skip ahead) live in a dev-only component compiled out of release builds. They are the one exception to the input rules above: a dev component may define its own `InputAction`s in code instead of an action asset.

## VR

Applies only to VR projects.

- Rendering: URP, Single Pass Instanced / multiview stereo rendering; Vulkan on Android-based standalone headsets. Use the target platform's foveated rendering where available.
- The camera is never moved, rotated, or scaled by game code without player input. No camera shake, no forced movement, no FOV changes.
- Maintain the target frame rate at all times; a dropped frame in VR is a comfort bug, not a polish issue.
- World-space UI only in VR; no screen-space overlays. Text readable at 1-2 m.
- Haptics for grab, tool contact, action completion, and impact. Every haptic has an audio equivalent for desktop mode.
- Scale: 1 unit = 1 meter; the player's real-world height maps to the rig. Test seated and standing.
- XR SDK and hand-interaction toolkit types are referenced only from the XR rig assembly. The XR rig adds the toolkit's grab and socket components at runtime to the objects that implement the Interaction contracts; no gameplay prefab carries them.
- Keep a desktop (mouse/keyboard) rig on the same Interaction contracts for the life of the project; it is the primary test harness when no headset is in the loop. Gesture-based actions have desktop equivalents that exercise the same Interaction components and completion rules. Document its controls in `docs/`.

## Performance

- Budget for the weakest target platform in `stack.md`. Standalone VR and phones are mobile-class GPUs.
- Cheapest rendering first: fix a look problem (clipping, glare, banding) through light balance, albedo and material. Propose a post-processing pass, an extra pass or a costlier feature only with proof that nothing cheaper works, and state its GPU cost.
- Zero GC allocations per frame in steady-state gameplay. Check with the Profiler's GC Alloc column.
- Pool frequently spawned objects (projectiles, pickups, VFX, audio sources) with `UnityEngine.Pool`.
- Small parts that come in numbers and change seldom (bolts, rivets, studs) are drawn as one mesh per owner, never one renderer each: a part is a run of vertices rewritten only when its state changes, on a copy of the mesh made at load.
- Instantiate/Destroy at scene load or between gameplay moments, not during tight interaction.
- Static batching for static environment geometry; GPU instancing or SRP Batcher-compatible shaders for repeated items.
- Baked lighting and light probes for static environments; real-time lights are exceptions. Light probes sit clear of every collider: a probe inside geometry bakes black. No lightmapped face runs under or into another piece (a floor under the walls): its texels there see the light through that piece and bleed it along the joint. Scene builders take the lightmapper from the project's Graphics setting, because the Editor rewrites a lighting settings asset whose lightmapper differs.
- Limit transparent overdraw (smoke, fire, glass). Particle systems have explicit max particle counts.
- Profile on the target device before optimizing; profile in the Editor only for GC and logic cost.
- Mark expensive sections with `ProfilerMarker` so they appear in captures.

On mobile-class targets:

- Mixed lights bake in Shadowmask mode (not Distance Shadowmask): static shadows come from the lightmaps and the probes' occlusion; only moving objects cast real-time shadows.
- No full-screen post-processing pass and no HDR colour buffer: a full-screen pass resolves the frame to memory and reads it back. If a tone curve is needed, apply it at the end of the opaque shader's forward pass.
- Anti-aliasing is MSAA in the URP asset: a tile-based GPU resolves the samples in tile memory, so it is the cheapest AA. FXAA, SMAA and TAA are full-screen passes (and TAA ghosts in VR).
- Opaque art uses URP Simple Lit or a project shader derived from it; URP Lit only where a measured need exists.

## Assets And Import

- Opening the project or entering Play mode never changes a committed file. Generated assets are saved in the state the Editor would leave them in (materials as URP's inspector validation leaves them, lighting settings with the project's lightmapper). A file that changes after opening the Editor is a generator bug; EditMode tests guard it.
- Import settings are set by presets or an `AssetPostprocessor`, not by hand per asset. Bump the postprocessor's version when a rule changes so Unity reimports.
- If the project has an asset import pipeline (an editor importer that builds model, material and prefab), assets enter Unity only through it; never copy or set up an asset by hand.
- Materials are separate assets remapped from the model's material names, never embedded in the model.
- Models from Blender bake axis conversion, but Blender still writes a +90° X rotation on each FBX root object. A prop prefab is therefore a clean root wrapping the model instance; the wrapper turns the model so the prop's front (Blender -Y) faces the prefab's +Z. Scenes place and rotate the wrapper, never the model root.
- Scene lighting values come from one shared source (lighting settings assets or a preset); scene builders never set light colours or intensities themselves.
- Textures: size by asset class, mipmaps on for 3D, compressed formats for the target platform.
- Models: exported in metres and imported at scale 1 with real-size meshes (an FBX in centimetres becomes a ×100 object over a 100× smaller mesh, and its generated lightmap UVs lose most texels to chart margins), no imported cameras/lights, Read/Write disabled unless needed, generate colliders off (colliders are authored).
- Audio: short SFX decompressed on load; voice lines and music compressed/streamed.
- No `Resources/` folder. Load content through serialized references in definitions. Addressables only if an actual loading or memory problem requires it.
- Asset names: `PascalCase` without type prefixes inside type-specific folders, e.g. `Art/Models/Props/CrateWooden.fbx`, `Data/Items/HealthPotion.asset`.

## Logging And Diagnostics

- Use a project logging wrapper with categories (e.g. `Log.Gameplay`, `Log.Interaction`) backed by `Debug.Log*`; verbose categories are stripped from release builds with `[Conditional]`.
- No `Debug.Log` in per-frame code except behind a dev-only toggle.
- Log domain events that explain a session: seed, key state changes, player actions applied, outcomes. A bug report should be reproducible from logs plus seed.
- Use `Debug.Assert` for invariants in dev builds.

## Editor Tooling

- Editor scripts live in `Editor` assemblies; runtime assemblies never reference `UnityEditor` (guard with `#if UNITY_EDITOR` only for small inspector conveniences inside runtime files, and prefer separate editor files).
- Build tooling (scenario generators, content validators, batch import) is editor code with menu items and a batchmode entry point where CI needs it.
- Custom inspectors only when they prevent real authoring mistakes.
- Dev-only on-screen help (IMGUI legends, prompts, debug crosshair) lives in `<Product>.Dev`, fed by public state of the runtime component it describes; runtime assemblies hold no dev text.

## Testing

- EditMode tests for Core and content validation: fast, run on every change.
- PlayMode tests for Interaction → Gameplay → Core wiring using test scenes or programmatically built rigs. Drive the Interaction layer directly; those tests do not test a rig.
- Each rig has its own PlayMode tests through its controls: the Input System's `InputTestFixture` adds simulated devices, the test presses and moves them (events queued, read on the next frame), and asserts what the rig did. The rig may expose `internal` test hooks to set up its pose (`InternalsVisibleTo` the PlayMode tests), never to fake input. The package is listed in `testables` in `Packages/manifest.json`.
- Tests must not depend on frame timing; step physics/time explicitly or await specific conditions with timeouts.
- Tests must not leave objects in the scene; clean up in `TearDown`.

## Forbidden

- Legacy Input Manager (`UnityEngine.Input`).
- `GameObject.Find*`, `FindObjectOfType`, `FindObjectsByType`, `SendMessage`, `BroadcastMessage` in runtime code.
- `Resources.Load` and a `Resources/` folder.
- Public serialized fields.
- Mutating ScriptableObject assets at runtime.
- `DontDestroyOnLoad` except on the composition root created by `Bootstrap`.
- `Camera.main` in per-frame code.
- Moving the VR camera from code.
