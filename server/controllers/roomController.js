//const { setRoom, getUser, setTeam, mapNameToId } = require('./userController');
const { ROOM_DEFAULTS, ROOM_LIMITS } = require("./config");

console.log(ROOM_DEFAULTS, ROOM_LIMITS);
const {
  ROOM_UPDATED,
  RCV_MSG,
  JOINED_ROOM,
  JOINED_TEAM,
  LEFT_TEAM,
  LEFT_ROOM,
  TEAM_CREATED,
  ADDED_PRIVATE_MEMBER,
  ROOM_CLOSED,
} = require("../socketActions/serverActions");
const RoomModel = require("../models/room");
const UserModel = require("../models/user");

// this is my db for now
rooms = {};

// cant store them in room_obj cause it causes lot of problems
// to stop comepetition
stopTimers = {};
// resolvers
resolvers = {};

// room_id will be admin name

const createRoom = (config, { socket }) => {
  const user = UserModel.getUser(config.userName);
  if (user.room_id) {
    // please leave current room
    return false;
  }

  // createRoom function to be called by the controller.
  const room_obj = RoomModel.createRoom(config, user);
  if (room_obj.status === 0) {
    return { err: room_obj.error };
  }
  const room_id = room_obj.returnObj.config.id;
  console.log(room_id);
  const user_obj = UserModel.updateUser({ userName: config.userName, room_id });
  socket.join(room_id);
  // created room
  // user already has an active room
  return room_obj.returnObj;
};

// users connecting to room
// TODO -> refactor this fn if should return error
const joinRoom = ({ userName, room_id, team_name }, { socket }) => {
  const user = UserModel.getUser(userName);
  const room_obj = RoomModel.joinRoom(user, room_id, team_name);
  if (room_obj.status === 0) {
    return { err: room_obj.error };
  }
  const user_obj = UserModel.updateUser({ userName, room_id, team_name });
  socket.join(room_id);
  socket.to(room_id).emit(ROOM_UPDATED, {
    type: JOINED_ROOM,
    data: { userName, profilePicture: user.profilePicture },
  });
  console.log(userName, " joined from ", room_id);
  return room_obj.returnObj;
};

const removeUserFromRoom = ({ userName }) => {
  const user = UserModel.getUser(userName);
  const { room_id, team_name } = user;
  const room_obj = RoomModel.removeUserFromRoom(user);
  if (room_obj.status === 0) {
    return false;
  }
  if (room_obj.status === 1) {
    // user removed from the team
    socket.leave(`${room_id}/${team_name}`);
    socket.to(room_id).emit(ROOM_UPDATED, {
      type: LEFT_TEAM,
      data: { userName, team_name },
    });
  }
  // user removed from the room
  console.log(userName, " removed from ", room_id);
  setRoom(userName, "");
  socket.to(room_id).emit(ROOM_UPDATED, {
    type: LEFT_ROOM,
    data: { userName },
  });
  socket.leave(room_id);
  return true;
};

const createTeam = ({ userName, team_name }, { socket }) => {
  const user = UserModel.getUser(userName);
  const { room_id } = user;
  console.log(user);
  const room_obj = RoomModel.createTeam(user, team_name);
  if (room_obj.status === 0) {
    return { err: room_obj.error };
  }
  socket.to(room_id).emit(ROOM_UPDATED, {
    type: TEAM_CREATED,
    data: { team_name },
  });
  return room_obj.returnObj;
};

const joinTeam = ({ userName, team_name }, { socket }) => {
  const user = UserModel.getUser(userName);
  const room_obj = RoomModel.joinTeam(user, team_name);
  if (room_obj.status === 0) {
    return { err: room_obj.error };
  }
  const user_obj = UserModel.updateUser({ userName, team_name });
  socket.join(`${user.room_id}/${team_name}`);
  socket.to(user.room_id).emit(ROOM_UPDATED, {
    type: JOINED_TEAM,
    data: { userName, team_name },
  });

  return room_obj.returnObj;
};

const leaveTeam = ({ userName }, { socket }) => {
  const user = UserModel.getUser(userName);
  const { room_id, team_name } = user;
  const room_obj = RoomModel.leaveTeam(user);
  if (room_obj.status === 0) {
    return { err: returnObj.error };
  }
  const user_obj = UserModel.updateUser({ userName, team_name: "" });
  socket.leave(`${user.room_id}/${user.team_name}`);
  socket.to(room_id).emit(ROOM_UPDATED, {
    type: LEFT_TEAM,
    data: { userName, team_name },
  });
  return room_obj.returnObj;
};

const closeRoom = ({ userName, forceCloseRoom }, { socket }) => {
  const user = UserModel.getUser(userName);
  const { room_id } = user;
  const room_obj = RoomModel.closeRoom(user, forceCloseRoom);
  if (room_obj.status === 0) {
    return { err: returnObj.error };
  }

  let allMembers = room_obj.returnObj;
  console.log(allMembers);
  // not need to chage room data since we are going to delete it
  allMembers.forEach((userName) => {
    // this is a server action notify all
    // TODO --> add kick all and remove functions for sockets
    UserModel.updateUser({ userName, room_id: "", team_name: "" });
  });

  // delete the stupid room
  const dataToEmit = "Room Closed";
  socket.to(room_id).emit(ROOM_CLOSED, {
    data: { dataToEmit },
  });
  socket.emit(ROOM_CLOSED);
  return true;
};

//TODO --> DELETE TEAM

const banMember = ({ room_id }) => {
  try {
  } catch (err) {
    return { error: err.message };
  }
};

const addPrivateList = ({ userName, privateList }, { socket }) => {
  // only private rooms can have private lists
  const user = UserModel.getUser(userName);
  const room_obj = RoomModel.addPrivateList(user, privateList);

  if (room_obj.status === 0) {
    return { err: returnObj.error };
  }

  socket.to(user.room_id).emit(ROOM_UPDATED, {
    type: ADDED_PRIVATE_MEMBER,
    data: { privateList: room_obj.returnObj },
  });
  return room_obj.returnObj;
};

const handleUserDisconnect = ({ userName }) => {
  // need to fill this
  try {
  } catch (err) {
    return { error: err.message };
  }
};

const forwardMsg = ({ userName, content, toTeam }, { socket }) => {
  try {
    const { room_id, team_name } = getUser(userName);

    // not in a room
    if (!room_id || !content) return false;

    let rcvrs = room_id;
    if (toTeam && team_name) {
      rcvrs += `/${team_name}`;
    }
    socket.to(rcvrs).emit(RCV_MSG, { userName, content, toTeam });
    return true;
  } catch (err) {
    return { error: err.message };
  }
};

const getRoomData = ({ userName, room_id }) => {
  try {
    const user = UserModel.getUser(userName);
    if (user.room_id !== room_id) throw new Error("User not in room");
    return rooms[room_id];
  } catch (err) {
    return { error: err.message };
  }
};

const getRoomsData = () => {
  try {
    return rooms;
  } catch (err) {
    return { error: err.message };
  }
};

module.exports = {
  createRoom,
  joinRoom,
  joinTeam,
  closeRoom,
  createTeam,
  getRoomData,
  getRoomsData,
  leaveTeam,
  removeUserFromRoom,
  forwardMsg,
  handleUserDisconnect,
  addPrivateList,
};
