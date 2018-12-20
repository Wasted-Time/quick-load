// <3 Pinkie Pie :3

module.exports = function QuickLoad(mod) {
	mod.settings.$init({
		version: 1,
		defaults: {
			maxDistance: 1000,		// Distance at which quick-load will always ignore loading screens
			longTele: false,		// Enables quick-load for long teleports beyond maxDistance
			longTeleHoldMs: 1000	// Hold duration to prevent falling through the map - Depends on your disk speed
		}
	})

	let zone = -1,
		serverQuick = false,
		modifying = false,
		myPos = null,
		spawnLoc = null

	mod.hook('S_LOGIN', 'raw', () => {
		zone = -1
		myPos = null
	})

	mod.hook('S_LOAD_TOPO', 3, {order: 100}, event => {
		serverQuick = event.quick

		if(event.zone === zone && (mod.settings.longTele || myPos.dist3D(event.loc) <= mod.settings.maxDistance))
			return event.quick = modifying = true

		myPos = event.loc
		zone = event.zone
		modifying = false
	})

	mod.hook('S_SPAWN_ME', 3, {order: 100}, event => {
		if(!serverQuick) spawnLoc = event

		if(modifying) {
			if(!myPos || myPos.dist3D(event.loc) > mod.settings.maxDistance)
				process.nextTick(() => { mod.send('S_ADMIN_HOLD_CHARACTER', 2, {hold: true}) })
			else modifying = false

			mod.send('S_SPAWN_ME', 3, event) // Bring our character model back from the void
			mod.send('C_PLAYER_LOCATION', 5, { // Update our position on the server
				loc: event.loc,
				dest: event.loc,
				type: 7
			})
		}
	})

	mod.hook('S_ADMIN_HOLD_CHARACTER', 'raw', () => !modifying && undefined)

	mod.hook('C_PLAYER_LOCATION', 5, event => {
		if(spawnLoc) {
			// Did we accidentally spawn under the map? Let's fix that!
			if(event.loc.z !== spawnLoc.loc.z) {
				mod.send('S_INSTANT_MOVE', 3, spawnLoc)
				spawnLoc = null
				return false
			}
			spawnLoc = null
		}
	})

	mod.hook('C_PLAYER_LOCATION', 5, {order: 100, filter: {fake: null}}, event => { myPos = event.loc })

	mod.hook('C_VISIT_NEW_SECTION', 'raw', () => {
		// If our client doesn't send C_PLAYER_LOCATION before this packet, then it's most likely user input
		spawnLoc = null

		if(modifying) {
			mod.setTimeout(() => { mod.send('S_ADMIN_HOLD_CHARACTER', 2, {hold: false}) }, mod.settings.longTeleHoldMs)
			modifying = false
		}
	})
}