/**
 * DiaryConfig_EN.js - Diary Text Configuration (English)
 */

export const DIARY_CONFIG_EN = {
    diary_meta: {
        weathers: [
            "☀️ Sunny, perfect for baking fur.",
            "☁️ Cloudy, good for hibernation.",
            "🌧️ Raining, time for a nap.",
            "🌬️ Windy, patrolling the window.",
            "✨ Starry night, very quiet.",
            "🌙 Hazy moon, suitable for snoozing.",
            "🔥 Fireplace is warm, don't want to move."
        ],
        moods: [
            "😐 Mood meh, ignoring humans.",
            "😊 Barely satisfied, granting a look.",
            "😠 Full of killing intent, stay away.",
            "😴 Sleepy as mud, do not disturb.",
            "😻 Happy, allowed to cuddle.",
            "😡 A bit grumpy, contemplating life.",
            "🐟 Hungry eyes, thinking only of food."
        ],
        keywords: [
            "#ThatRedDot", "#CardboardBox", "#YuckyPill", "#CatTeaser",
            "#SparrowOutside", "#SofaParkour", "#AfternoonNap", "#HumanSlave"
        ]
    },

    special_days: {
        // Christmas Eve
        "12-24": {
            weather: ["🎄 Smells like roast chicken in the air", "✨ Stars blinking on the tree top"],
            mood: ["🎅 Waiting for the red fat man", "🧦 Checking the salty fish in the sock"],
            events: [
                "The two-legged beast hung a red sock by the bed. It can't fit me, so I stuffed a dead mouse in it. Surprise.",
                "They say a fat man climbing chimneys is coming tonight. I'm guarding the fireplace, ready to collect toll (cans)."
            ]
        },
        // Christmas
        "12-25": {
            weather: ["❄️ Sunny day for unwrapping gifts", "🎁 Room full of tearing paper sounds"],
            mood: ["👑 I am the star on the tree", "📦 Addicted to boxes"],
            events: [
                "Boxes piled up under that green spike monster (Christmas tree). I helped tear up all the wrapping paper. No thanks needed.",
                "The two-legged beast is giggling there, but I only care about the turkey. Usefully I got a leg. Happy holidays to my stomach."
            ]
        }
    },

    offline_events: [
        {
            weight: 20,
            type: 'normal',
            text: [
                "Hour {hours} of two-legged beast disappearance. The sparrow provoked me three times, but that's my tactical reserve for tonight.",
                "Home alone, patrolled 5 times. All good, except the pen fell on the floor again.",
                "Took a long nap. Woke up to find the sun moved, human still not back.",
                "Pretending to sleep, secretly observing everything. This house holds many secrets."
            ]
        },
        {
            weight: 50,
            type: 'damage_chance',
            text: [
                "That glass cup was shivering on the edge. To help it, I gave it a push. Gravity verified.",
                "Decided to restyle the sofa. Added some scratches. Human should like my design.",
                "The flowers in the vase were in the way. Helped them move to the floor."
            ]
        },
        {
            weight: 10,
            type: 'mystery',
            text: [
                "The invisible guy in the corner came again. Discussed quantum mechanics with it.",
                "Meowed at the air, heard a response? Something else lives here?",
                "Found a new light spot dancing on the wall. Hunted it for half an hour."
            ]
        }
    ],

    specific_items: {
        'food_bowl': [
            "A new bowl in my territory. Checked it, empty! Is this a provocation?",
            "New bowl? Design is okay, hope it fits more premium cans.",
            "Human placed a new altar (bowl). I'll guard it until offerings appear."
        ],
        'litter_box': [
            "Another toilet. Human is obsessed with collecting my poop.",
            "New sand box, feels good on paws. Christening it tonight.",
            "My new meditation room. Human keep distance."
        ],
        'bed': [
            "A soft trap. I accidentally fell in and slept for 4 hours.",
            "This thing smells new. Needs my fur to make it home."
        ],
        'RobotVacuum': [
            "That flat disc is running around again. Decided to ride it like a king.",
            "Riding the disc feels like ruling the world. Human looks impressed.",
            "My private chariot. It goes where I sit."
        ]
    },

    buy_floor: [
        "A giant thing called [{item}] appeared. The box it came in is 5 stars.",
        "Stupid human brought [{item}]. Blocks my parkour route. I commandeered the box though.",
        "New throne [{item}] is passable. But the delivery box is the invention of the century."
    ],
    buy_small: [
        "Something called [{item}] on the table. Looks satisfying to push off.",
        "New tribute [{item}]? Placement lacks aesthetic, but I'm too lazy to correct.",
        "That [{item}] blocks my patrol path. Will slap it down later."
    ],
    buy_wall: [
        "Weird thing [{item}] on the wall. Want to jump and scratch it.",
        "That [{item}] is high up, mocking me. Wait till I grow taller.",
        "Human pasting things on wall again. This house is becoming a mess."
    ],
    feed: [
        "Not hungry, but ate a bite so he doesn't cry.",
        "Can opener was 3 seconds late. Recorded in my notebook.",
        "Human served the royal meal. Ate half to show mercy.",
        "Eating is serious business. Why is he watching? Pervert?"
    ],
    clean: [
        "He's stealing my poop again. Human hoarding habit is baffling.",
        "Toilet cleaned. I'll poop more tonight as a reward.",
        "Watching him dig for treasure in the litter box is hopeless."
    ],
    pet_happy: [
        "Technique passable. Allowed 2 more minutes.",
        "Mood is good, petting allowed. Consider it charity.",
        "Knows where to scratch? Slave finally learned.",
        "Purring... not because I like it, just throat itch."
    ],
    pet_angry: [
        "Dare to touch me when I'm grumpy? Slapped.",
        "Don't touch! My fur style can't be messed up!",
        "Disturbing the king at this hour? Death penalty!"
    ],
    open_blind_box: [
        "Human opened a box, light jumped out scared me.",
        "Box turned into a pony. Magic? I remain skeptical.",
        "Witnessed a box disappear. Human always brings weird stuff."
    ]
};
