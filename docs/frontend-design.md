Refer to backend-design.md to view the JSON schema. Each time a play is made, a new game state JSON is passed to the frontend. Refer to hilo-rules.md for game rules.

The user begins their journey on the LANDING PAGE.

### LANDING PAGE 
- When a user goes to the LANDING PAGE, they are presented with two buttons - “Create Lobby” and “Join Lobby”
- Create lobby. This has a button titled “Create Lobby”. This sends an HTTP post request to the backend which expects to get back a UUID. The user is taken to the LOBBY PAGE with URL corresponding with the game UUID being passed through URL parameters (i.e. localhost:8000/gameid=asdflkj). The first person to join this room is called the LEADER.
- Join lobby. There is a text input box with the default text “Enter room id…”. Immediately next to it, there is a button titled “Join”. This text box is meant to accept room ids corresponding to rooms which get sent to the backend with via HTTP post. If an error is returned, that error should be displayed in red text underneath the input box.
- Once a user has successfully done one of these actions, they proceed to the LOBBY PAGE.

### LOBBY PAGE
- Copy link - There is a button called “Copy link” which copies the link corresponding with the correct url parameter.
- The LEADER has the option to click “Begin Game” which starts the game.
- Each joining player has copy link and waiting bar. 
- Player id stored in the browser cache and is auto generated upon joining room
- Default is the previously entered name
- Player can enter their name which is a cosmetic layer displayed later
- Upon clicking “Begin Game”, the following happens
    - Players currently in the lobby are added to a game and the corresponding  player ids are sent to the backend via HTTP post at an “Initialize game” endpoint.
    - An initial game state, represented by a JSON containing a map of player id to a set of cards is returned.
    -  Any other player who tries to join this game gets a separate “spectator” screen where they can view all cards visible to any player (FACEUP PILE and HAND).

### GAME PAGE
- There are a few key zones in the GAME PAGE. The HAND, the FACEUP PILE, and the FACEDOWN PILE.
- First, the HAND design. A player's HAND is displayed on the bottom of of the screen. It should take up 1/10 of the screen. The HAND can be quite large, so if the number of cards would overflow outsite the screen, a scroll wheel should emerge. The HAND should be sorted first in order of rank. i.e. 2, then 3, then 4, and so on.
- In the SETUP phase, the 6 remaining cards should start in the HAND. They should all be selectable. Above them, there should be 3 card slots and a greyed out confirm button. When a card is selected, it should move that card to one of the free card slots. When all 3 slots are full, the cards in HAND shouldn't be selectable. Cards in the slots should always be selectable, and when clicked return to hand. When all 3 slots are full, the confirm button becomes blue and clickable.
- Upon clicking confirm, a request gets sent to the backend.
- When everyone is confirmed, move to turn play.
- In TURN PLAY, a player can view their HAND. There is a button titled “Show face up cards” which minimizes the hand and brings up the FACEUP PILE. Upon doing so, it gets replaced with a “Hide face up cards” button which reverses this.
- Since a player can only see their HAND and everyone’s FACEUP PILES, those cards should be face up and display their suit and number. Otherwise, they are face down, and show a generic card backing.
- If a player is ACTIVE, they should initially see their PLAYABLE CARDS highlighted in green. There should be a subtle animation, fading in over two seconds and fading out over two seconds. This animation is only visible if the card is face up.
- PLAYABLE CARDS should be selectable by the ACTIVE PLAYER. As the rules state, you can only select cards of the same rank. Upon selecting the first PLAYABLE CARD, only continue to highlight other playable cards of the same suit.
- There is a button titled “Submit” which puts all selected cards into the shared PILE.
- UNPLAYABLE CARDS are not highlighted.
- There should be a set of animations corresponding to different kinds of plays. Each animation starts as small text at the bottom of the screen and rapidly expands into larger text in the middle of the screen. Here are examples kinds of plays which we may want:
    - Bonus play - blue text
    - Exploded! Play again - green text
    - No plays available - red text