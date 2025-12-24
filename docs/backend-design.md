# HILO Backend
* Manages the state for the lobby and game.
* Serves frontend pages over http.
* Connects clients to server with SocketIO.
* Stores the state in Redis. (Game log).
* Implements a game engine.

Constraints:
* Written in typescript, to share common type definitions between frontend and backend.
* Express.js for the backend server
* SocketIO integrated with Express.js for the socket backend.

## Lobby -> Game
There's a state machine to go from lobby to game start, as described in the frontend-design

Create -> Join -> Start, where one player is the leader and the other players join.

## Game
The game proceeds from Setup -> Turn (-> Turn -> Turn -> Turn...) -> End.

At each action, there is an item added to the log for each action, and a "current state" broadcast out.
