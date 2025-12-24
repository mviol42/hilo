# HILO RULES

Hi-Lo is a turn-based card-game. Each player is aiming to play all of their cards, before the other players can do so.

## SETUP
The game is played with 1 standard, 52 card deck for every 4 people. For example, 2-4 players will use 1 deck, 5-8 players use 2 deck, 9-12 players use 3 decks, and so on; No jokers are used.

Each player is dealt 9 random cards.
* 3 are FACEDOWN cards. These are separate, face-down and "hidden" (visible to no-one, not even the player).

Of the 6 remaining cards, the player chooses:
* 3 cards to keep FACEUP (visible to all players)
* 3 remaining cards, to be added to the player's hand (visible to just that player).

The rest of the cards are set aside in the DECK.

## GAMEPLAY
The gameplay has turn-based mechanics:

Each TURN, a player plays a card according to card rules.

### CARD RULES
Given: a PILE, and player's cards, the card rules determine which sets of the player's cards may be added to the pile.

The rank must be playable, as follows:

* Ranks 2, 8, or 10 are "special" and always playable.
* Other ranks are playable depending on the PILE
    * 8s on the top of the PILE are considered "invisible": the player ignores any 8s on the top of the pile for the purposes of this determination.
    * If the PILE is empty, the player all ranks are playable.
    * If the top card of the PILE is a 7, ranks LOWER OR EQUAL to 7 are playable; Otherwise, ranks GREATER OR EQUAL to the rank of the top card of the PILE are playable

Any set of one or more cards of a playable rank are playable together.

The ranking comparison keeps ace as high. Ranking lowest->highest is 2-7,9, Jack, Queen, King, Ace; (8 is "invisible" and depends on the card beneath it (if there is one)).

It is possible that no card may be played; in that case, the error `No Playable Card` is returned.

## PLAYER TURN

## FIRST TURN PLAY
The player with the lowest non-special card goes first. In the case of ties, a random player with the lowest non-special card will go first.
The selected player will play one or more of that lowest rank card.

After playing, the POST PLAY steps proceed.

### SUBSEQUENT TURN PLAY
The player chooses a card to play.

* If the player has cards in their HAND, then they pick a set of playable cards from their HAND according to `CARD RULES`. If no cards in their HAND are playable, the player picks up the PILE to the player's hand.
* If the player has no cards in their HAND, they a set of playable cards from their FACEUP cards. If no cards are playable, the player picks up the PILE to the player's hand AND adds one or more of their FACEUP cards of the same rank.
* If the player has no cards in HAND or FACEUP cards, the player selects a FACEDOWN card (by position). If the card is playable on the PILE, they play it onto the pile (as usual). If the card is NOT playable, the player picks up the PILE and the unplayable (previously FACEDOWN) card. 

NOTE: If a player can play a card, they must play at least 1 of that rank (but, a player is not required to play ALL of that rank.)

NOTE: A player must run out of their HAND cards, then they must play all their FACEUP cards, then finally they must play the FACEDOWN cards.

BONUS PLAY: If the player's HAND was not empty before playing, but now is EMPTY after playing, the player may also play any of the same rank cards from his/her FACEUP pile.


### PLAY EFFECTS
* If the player played a 10, the player "BLOWS UP" the PILE.
* If the top 4 cards of the PILE are the same rank, then the player BLOWS UP the pile. 8s are NOT invisible for this mechanic (e.g. 5 5 5 5 -> blow up, but 5 5 5 8 5 -> no blow up).

To resolve the BLOW UP action: The PILE is DISCARDED and immediately removed from the game; the player who BLEW UP the pile will take another turn after POST PLAY.

### POST PLAY
In order:

1. If the player has fewer than 3 cards in their hand, then they draw cards from the DECK until their hand has 3 cards. Note: they can only draw as many cards from the deck as are in the deck; if they need 2 cards but there's 1 card in the deck they draw 1 and if the deck is empty the no one will draw the rest of the game.
2. If the player has no cards left (no HAND, no FACEUP, and no FACEDOWN), then the player wins and the game is over.
3. If the player BLEW UP the PILE that turn, the player takes another turn (leaving POST PLAY early).
4. Otherwise, is now the next player's turn in the sequence, following SUBSEQUENT TURN instructions.

### BLOW UP
Any time a player BLOWS UP the PILE, the pile is DISCARDED, and the player who blew up the pile gets to take another turn.

## WIN CONDITION
If a player ever runs out of all cards (hand, FACEUP, and FACEDOWN), then the player wins the game.
