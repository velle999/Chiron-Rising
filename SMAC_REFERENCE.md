# SMAC Mechanics Reference — Chiron Rising Design Bible
# Extracted from the official manual (252 pages)

## RESOURCES (per tile, per turn)

### Nutrients (Rainfall)
- Arid: 0
- Moist: 1  
- Rainy: 2
- Rocky terrain: negates ALL nutrient production regardless of rainfall

### Minerals (Rockiness)
- Flat: 0
- Rolling: 1
- Rocky: 1

### Energy (Elevation)
- Requires solar collector to harvest
- 1 energy per 1000m elevation level (1-4 energy possible)
- Ocean: 1 energy per shelf square

### Fixed Terrain
- Base square: 2 nutrients, 1 mineral, 2 energy (always)
- Forest: 1 nutrient, 2 minerals, 0 energy
- Monolith: 2 of each
- Thermal Borehole: 0/6/6

### Modifiers
- River: +1 energy
- Farm: +1 nutrient (land only, no rocky/fungus)
- Kelp Farm: +2 nutrients (ocean shelf)
- Soil Enricher: +1 nutrient (on farms only)
- Mine: +1 mineral (flat/rolling), +2 (rocky), -1 nutrient (if >1)
- Road in mined rocky: +1 mineral additional
- Solar Collector: enables elevation energy
- Tidal Harness: +2 energy (ocean shelf)
- Nutrient/Mineral/Energy Bonus: +2 of respective type
- Recycling Tanks: +1/+1/+1 (base square only)

### Resource Caps
- Max 2 of any resource per tile until specific techs discovered
- Gene Splicing: lifts nutrient cap
- Ecological Engineering: lifts mineral cap  
- Environmental Economics: lifts energy cap

### Fungus Resources (unlock with tech)
- Centauri Ecology: +1 nutrient
- Centauri Meditation: +1 energy
- Centauri Genetics: +1 mineral
- Centauri Psi: +1 more nutrient
- Secrets of Alpha Centauri: +1 more energy

## TERRAFORMING
Action | Rate (turns) | Requires
Farm | 4 | Centauri Ecology
Soil Enricher | 8 | Adv. Ecological Engineering
Mine | 8 | Centauri Ecology
Solar Collector | 6 (+2 rocky) | Centauri Ecology
Plant Forest | 4 | Centauri Ecology
Build Road | 1 (+1 river, +2 fungus, +2 forest, +1 rocky) | Centauri Ecology
Mag Tube | varies | Monopole Magnets
Bunker | 5 | Advanced Military Algorithms
Airbase | 10 | Doctrine: Air Power
Remove Fungus | 6 | Centauri Ecology
Plant Fungus | 4 | Ecological Engineering
Condenser | 12 | Ecological Engineering
Echelon Mirror | 12 | Ecological Engineering
Thermal Borehole | 24 | Ecological Engineering
Raise/Lower Terrain | 12 | Environmental Economics
Level Terrain | 8 | Centauri Ecology
Aquifer | 18 | Ecological Engineering

## MOVEMENT
- Infantry: 1 move/turn
- Speeder: 2 moves/turn
- Hovertank: 3 moves/turn
- Road: 1/3 movement point
- River: 1/3 movement point (acts as road)
- Mag tube: free movement
- Rocky/Forest: 2 movement points to enter
- Land fungus: always ends movement (exception: mindworms, Xenoempathy Dome)
- Sea fungus: 3 movement points

## COMBAT SYSTEM
- Attacker strength vs Defender strength
- Probability of doing damage = side's proportion of combined strengths
- Example: Atk 10 vs Def 20 = attacker damages 1 in 3, defender 2 in 3
- Repeats until one side destroyed
- Winner can come out severely damaged

### Combat Modifiers
- Rocky terrain: +50% defense
- Fungus: +50% defense (except vs native life, which gets +50% offense instead)
- Mobile units in flat/rolling: +25% offense
- Base/Bunker: +25% defense, no collateral damage
- Infantry attacking base: +25% offense  
- Perimeter Defense: doubles defense in base
- Tachyon Field: +1 defense multiplier (triples with Perimeter Defense)
- Sensors (within 2 squares): +25% defense
- Altitude (artillery): +25% per level above target
- Hasty assault (<1 full move): penalty proportional to move fraction lost
- Airdrop same turn: -50% attack
- Non-combat units: -50% defense vs combat units
- Ships in port vs land/air: -50% defense (net -25% with base bonus)

### Psi Combat
- Ignores weapon/armor values entirely
- Based on MORALE level only
- Attacker gets 3:2 advantage vs land defenders
- Planet rating: +10% psi attack per positive level
- Hypnotic Trance: +50% psi defense
- Empath Song: +50% psi attack
- Neural Amplifier project: +50% psi defense
- Dream Twister project: +50% psi attack

### Damage & Repair
- 10% repair per turn minimum
- +10% in friendly territory
- +10% in base
- +10% in bunker (land) or airbase (air)
- Max 80% via field repair (need base facilities for full)
- Command Center: full land repair in 1 turn
- Naval Yard: full naval repair in 1 turn
- Aerospace Complex: full air repair in 1 turn

### Stacked Combat
- Best defender fights first (or designated defender)
- If defender loses and not in base/bunker: collateral damage to rest of stack
- Non-combat units destroyed with last combat unit

### Disengagement
- Faster defender can disengage at 50% damage
- ECM Jammer prevents disengagement
- Cannot disengage if defender attacked previous turn

## MORALE LEVELS
1. Green (Disciplined for natives)
2. Disciplined (Mature Boil)
3. Hardened (Great Boil)
4. Veteran (Demon Boil)
5. Commando (Locusts of Chiron)
6. Elite (Transcending)

## BASES

### Founding
- Colony Pod consumed, creates size 1 base
- Cannot found on rocky, fungus, or monolith squares
- Base square automatically worked (2N/1M/2E before improvements)
- Production radius: 20 surrounding squares up to 2 hex away

### Citizens
- Workers: normal, work tiles
- Talents: skilled professionals (offset drones)
- Drones: unskilled troublemakers
- Specialists: work inside base (don't work tiles)

### Specialist Types
- Doctor: +2 Psych (obsoleted by Centauri Meditation → Empath)
- Technician: +3 Economy (obsoleted by Fusion Power → Engineer)
- Librarian: +3 Labs (requires Planetary Networks, obsoleted → Thinker)
- Engineer: +3 Economy, +2 Labs (requires Fusion Power)
- Empath: +2 Economy, +2 Psych (requires Centauri Meditation)
- Thinker: +1 Psych, +3 Labs (requires Mind/Machine Interface)
- Transcend: +2 Economy, +4 Labs, +2 Psych (requires Secrets of Alpha Centauri)

### Golden Age
- Requires: size ≥3, no drones, talents ≥ workers
- Effect: +2 Growth, +1 Economy equivalent

### Drone Riots
- Drones > Talents = riot
- Shuts down research and production
- Can destroy facilities, cause defection
- Fix with: police units, Psych allocation, facilities, Social Engineering

### Population Growth
- Nutrient surplus fills nutrient tanks
- Growth threshold = (pop + 1) × 10 nutrients (adjustable)
- Growth rating modifies rate (-3 to +6)
- Growth 6 = POPULATION BOOM (grow every turn)
- Starvation if deficit exceeds stored nutrients

## SOCIAL ENGINEERING

### Four Categories, Four Choices Each

#### POLITICS (how decisions are made)
- Frontier: default, no modifiers
- Police State: +2 Support, +2 Police, -2 Efficiency
- Democratic: +2 Efficiency, +2 Growth, -2 Support
- Fundamentalist: +2 Probe, +1 Morale, -2 Research

#### ECONOMICS (resource administration)
- Simple: default, no modifiers
- Free Market: +2 Economy, -3 Planet, -5 Police
- Planned: +2 Growth, +1 Industry, -2 Efficiency
- Green: +2 Efficiency, +2 Planet, -2 Growth

#### VALUES (societal priorities)
- Survival: default, no modifiers
- Power: +2 Support, +2 Morale, -2 Industry
- Knowledge: +2 Research, +1 Efficiency, -2 Probe
- Wealth: +1 Economy, +1 Industry, -2 Morale

#### FUTURE SOCIETY (advanced options)
- None: default
- Cybernetic: +2 Efficiency, +2 Planet, +2 Research, -3 Police
- Eudaimonic: +2 Economy, +2 Growth, +2 Industry, -2 Morale
- Thought Control: +2 Morale, +2 Police, +2 Probe, -3 Support

### Upheaval Costs
- Radical social changes cost energy credits
- Gradual changes over multiple turns reduce cost

## SOCIAL FACTORS (effects of ratings)

### Economy: -3 to +5
Affects energy production per base and per square, commerce income

### Efficiency: -4 to +4
-4 = ECONOMIC PARALYSIS, +4 = PARADIGM ECONOMY

### Support: -4 to +3
Determines free units per base (-4 = each costs 2, +3 = base size units free)

### Morale: -4 to +4
Directly modifies unit morale level

### Police: -5 to +3
Determines police units allowed, drone penalties for units away from base

### Growth: -3 to +6
-3 = ZERO POP GROWTH, +6 = POPULATION BOOM (grow every turn)

### Planet: -3 to +3
Ecological disruption, fungus production, mindworm capture chance

### Probe: -2 to +3
Probe team morale and defense against enemy probes

### Industry: -3 to +5
Mineral cost modifier (-30% to -50%)

### Research: -5 to +5
Labs research speed modifier

## FACTION BONUSES (starting modifiers)

### Gaians: +1 Planet, +2 Efficiency, -1 Morale, -1 Police, +1 nutrients in fungus
### Hive: +1 Growth, +1 Industry, -2 Economy, free Perimeter Defense
### University: +2 Research, -2 Probe, free Network Node, +1 bonus tech, extra drone/4 citizens
### Morgan: +1 Economy, -1 Support, commerce bonus, starts with 100 energy, needs Hab Complex at size 4
### Spartans: +2 Morale, +1 Police, -1 Industry, free prototypes
### Believers: +25% attack, +1 Probe, -2 Research, -1 Planet, no research until MY 2110
### Peacekeepers: -1 Efficiency, extra talent/4 citizens, +2 Hab limit, double council votes

## ENERGY ALLOCATION (three sliders, must sum to 100%)
- Labs: research speed
- Psych: workers→talents conversion (2 energy = 1 talent)
- Economy: facility maintenance, excess → reserves
- Default: 50% Labs, 50% Economy, 0% Psych
- Extreme allocations create inefficiency (diminishing returns)

## DIPLOMACY
### Relations: Vendetta → Truce → Treaty → Pact of Brotherhood
### Treaty: commerce between bases, stay out of territory
### Pact: share maps, share report readouts, free movement, doubled commerce
### Mood levels (best to worst): Magnanimous, Solicitous, Cooperative, Noncommittal, Ambivalent, Obstinate, Quarrelsome, Belligerent, Seething
### Integrity: Noble → Faithful → Scrupulous → Dependable → Ruthless → Treacherous
### Actions: trade tech, trade maps, trade energy, loans, gifts, joint attacks, territory violations

## VICTORY CONDITIONS
1. Conquest: eliminate all factions (surrendered count as eliminated)
2. Diplomatic: 3/4 vote as Supreme Leader (requires Mind/Machine Interface)
3. Economic: corner Global Energy Market (requires Planetary Economics)
4. Transcendence: complete Ascent to Transcendence secret project

## REACTORS
- Fission: 10 HP, value 1 (starting)
- Fusion: 20 HP, value 2 (Fusion Power)
- Quantum: 30 HP, value 3 (Quantum Power)
- Singularity: 40 HP, value 4 (Singularity Mechanics)

## CHASSIS
- Infantry: 1 move, land
- Speeder: 2 move, land
- Hovertank: 3 move, land
- Foil: 4 move, sea, carries 2×reactor units
- Cruiser: 6 move, sea, carries 4×reactor units
- Needlejet: 8 move, air, 2 turn range
- Chopper: 8 move, air, no fuel limit but takes damage outside base
- Gravship: 8 move, air, unlimited range
- Missile: 12 move, air, destroyed after attack

## UNIT DESIGN
Components: Chassis + Weapon + Armor + Reactor + up to 2 Special Abilities
Prototype: first build of new component combo costs +50% minerals, gets +1 morale
