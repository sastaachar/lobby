lobby
The lobby module for the platform will be implemented using a Node.js server hosted on heroku, this server will be responsible for handling the major business logic for the platform.

The server will be communicating with the client (Frontend) using web-sockets and we will be using socket.io for the task, socket.io will enable us to have a realtime bi-directional communication between the server and the web clients. Although socket.io uses web-sockets primarily it also has pooling as a fallback option. The lobby server will be responsible for the following major tasks : Manage active rooms/lobby and its state. Manage active users and their state. We will store the required state data for both the room and users as Javascript objects and store them in memory for the least amount of response time which in turn will give the users the least amount of latency. We will be following MVC pattern for the implementation.

Models : we have 2 major models , Room User This module will have the basic structure of the Rooms and users and will have methods to update the same.

Controllers : The controllers will be responsible for managing the state of the user and rooms and handle the different interaction between them.
