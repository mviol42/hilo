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
Generally, a player must play one or more cards of the same rank such that the rank is higher than or equal to the top card of the PILE, or the rank is a special rank. (If the PILE is empty, then the player gets a free play of any rank.)

The ranking comparison keeps ace as high: highest cards are Jack, Queen, King, Ace

The following ranks are *special* and may *always* be played (even if they are lower than the previous card): 2, 8, 10

Playing a 10 also has a special effect to "BLOW UP" the pile. (The PILE is then DISCARDED aside and removed from the game, and the player may take another turn)

Two cards modify the rules for the next card played:

7: Instead of being HIGHER, the rank of the next card played must be LOWER OR EQUAL to the 7 (i.e. 2-7 OR any special rank which may always be played).

8: Is treated as an "invisible" card; the next rank to follow an 8 would play with respect to the top card of the PILE that is NOT an 8 (even if there are multiple). If there is no card other than 8 in the pile then any card may be played. This behavior may "stack" with the 7, so an 8 on top of a 7 would force the next player to play lower-or-equal to 7.

It is possible that no card may be played.

## TURN PLAY

## FIRST TURN
The player with the lowest non-special card goes first.
That player will play one or more of that lowest rank.

After playing, the POST PLAY steps proceed.

### SUBSEQUENT TURN PLAY
The player chooses a card to play.
* If the player has cards in their hand, then they pick a rank according to card rules. The player plays 1 or more of those cards on the top of the PILE (if they have multiple). If they can't play, the player add the PILE to the player's hand.
* If the player has no cards in their hand, they pick a rank according to the card rules from their FACEUP cards, and play 1 or more cards of that rank. If they can't play, the player picks a rank from rank from their FACEUP cards, and adds 1+ cards of the same rank to their hand; AND add the pile to the player's hand.
* If the player has no cards in their hand and no FACEUP cards, then the player FLIPS one of the face-down cards face up (choosing by position). If the card is playable according to the card rules, it is played onto the PILE as usual. Otherwise (if the face-down card selected was unplayable), then the face-down card is added to the player's hand and the PILE is added to the player's hand.

NOTE: If a player can play a rank, they must play at least 1 of that rank (but, a player is not required to play ALL of that rank.)

NOTE: A player must run out of their hand cards, then they must play all their FACEUP cards, then finally they must play the FACEDOWN cards.


### POST PLAY
In order,

* If the top 4 cards of the PILE have the same rank, then the PILE is blown up (the player may take another turn).

* If the player has fewer than 3 cards in their hand, then they draw cards from the DECK until their hand has 3 cards. Note: they can only draw as many cards from the deck as are in the deck; if they need 2 cards but there's 1 card in the deck they draw 1 and if the deck is empty the no one will draw the rest of the game.

* If, after drawing, the player can play one or more cards of the same rank matching exactly the rank of the card on the top of the pile (not counting 8 as special). (In case a card is played, POST PLAY actions are restarted.) The player may choose not to play more of the same card on the pile, even if they can.

* If the player has no cards left (no hand, no FACEUP, and no FACEDOWN), then the player wins and the game is over.

It is now the next player's turn following SUBSEQUENT TURN instructions.

### BLOW UP
Any time a player BLOWS UP the PILE, the pile is DISCARDED, and the player who blew up the pile gets to take another turn.

## WIN CONDITION
If a player ever runs out of all cards (hand, FACEUP, and FACEDOWN), then the player wins the game.
