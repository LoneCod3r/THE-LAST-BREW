/** Every line the reading says: the archive it unlocks, and what the live region describes. */

export const ARCHIVE = {
  title: 'THE LAST DROP',
  body: [
    '7:20.',
    'You drank the coffee and kept the cup. Then you looked into what was left.',
    'A clock with no numbers. A word half washed away. A question pressed into the base. None of them told the whole story. You had to trust what you noticed, follow what remained, and let the separate pieces find their place.',
    'The word was TWELVE. The drip led to the mark beneath the handle. That gave you the beginning. The hands gave you the rest. Seven twenty.',
    'Perhaps that is all a mystery ever asks of you: to look a little closer, to trust your own attention, and to recognise when things that seemed separate begin to make sense together.',
    'For centuries, people have searched for meaning in the grounds left at the bottom of a cup. Some have looked for predictions. Others have found reflections of what they already carried within themselves. This cup offered no promise about the future. Only a moment of stillness, and something waiting to be understood.',
    'That is what this whole archive was for. Every lock, every log, every hat and every cup was made for the same kind of person: someone who enjoys a good coffee, notices small things, and would rather work a mystery out than be told the answer.',
    'You found the time. What it means beyond that is yours to decide.',
    'This page keeps no record of you. Close it, and the cup fills again for the next curious person.',
  ],
} as const;

/** Spoken after each sip (index: sips taken). */
export const AFTER_SIP = ['', 'A sip. About two thirds left.', 'Another sip. One left.', 'The last sip. Only the grounds are left.'] as const;

/** Spoken with the view, once the cup is empty. */
export const SEEN = {
  clock:
    'Grounds on the bottom form a clock face: twelve marks and no numbers. A trail runs in from the wall and ends on the mark below the handle. Counting clockwise from that mark, the long hand points at the fourth mark; the short hand is a third of the way from the seventh mark to the eighth.',
  word: 'On the inside wall above the handle, letters in the grounds: T, W, a drip that hides one letter, L, V, E. The drip runs on down into the cup.',
  stamp: 'Pressed into the base: one slot, a colon, two slots.',
} as const;

export const WRONG = 'The grounds disagree.';
