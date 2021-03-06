//* import utils

const auth = require("../utils/auth");

// this is my db for now
rooms = {};

const ROOM_DEFAULTS = {
  max_teams: 5,
  max_perTeam: 5,
  max_perRoom: 25,
  competitionTimelimit: 2700000,
  competitionMaxQues: 3,
  // should be less than number of questions , but fuck it
  vetoMaxVote: 1,
  vetoTimeLimit: 300000,
  vetoQuestionCount: 6,
};

// TODO : reconsider the limits
const ROOM_LIMITS = {
  max_teams: 25,
  max_perTeam: 10,
  max_perRoom: 250,
  competitionTimelimit: 21600000,
  competitionMaxQues: 20,
  vetoMaxVote: 1,
  vetoTimeLimit: 18000000,
  vetoQuestionCount: 25,
};

const getProperValue = (field, passedValue) => {
  // * Helper function to get the appropriate value for the field
  // TODO : will require testing

  return Math.min(ROOM_LIMITS[field], passedValue || ROOM_DEFAULTS[field]);
};

const createRoom = (roomConfig, user) => {
  // TODO : @sastaachar

  // TODO : refactor casing (camel -> _ )

  // check req params

  if (!roomConfig.userName) {
    return {
      status: 0,
      error: "You dont have the privilege to do",
    };
  }

  //* Start creating a new room

  // we nee a *unique* room_id

  // ! change this fn
  const room_id = auth.encryptData(roomConfig.userName);

  if (rooms[room_id]) {
    return {
      status: 0,
      error: "There is already a room present by the id given",
    };
  }
  const room_obj = {
    config: {
      id: room_id,
      admin: roomConfig.userName,
      max_teams: getProperValue("max_teams", roomConfig["max_teams"]),
      max_perTeam: getProperValue("max_perTeam", roomConfig["max_perTeam"]),
      privateRoom: roomConfig.privateRoom === false,
      max_perRoom: getProperValue("max_perRoom", roomConfig["max_perRoom"]),
      createdAt: Date.now(),
    },
    state: {
      privateList: [],
      cur_memCount: 1,
      banList: [],
      bench: [roomConfig.userName],
      profilePictures: { [roomConfig.userName]: user.profilePicture },
    },
    teams: {},
  };

  //* Store the room now
  rooms[room_id] = room_obj;
  return { status: 1, returnObj: room_obj };
};

const joinRoom = (user, room_id, team_name) => {
  const { userName, profilePicture } = user;
  if (
    !rooms[room_id] &&
    (!rooms[room_id].config.privateRoom ||
      !rooms[room_id].state.privateList.includes(userName)) &&
    rooms[room_id].state.cur_memCount > rooms[room_id].config.max_perRoom
  ) {
    return { status: 0, error: "The User doesn't meet the specifications" };
  }
  //(only run if room exists) and (user is allowed if private) and (space is there)

  //quit from prev room and try again
  if (user.room_id) {
    //already in a group don't allow
    return { status: 1, error: "User already in room" };
  }

  //successful (user will now be added)

  if (
    team_name &&
    rooms[room_id].team[team_name] &&
    rooms[room_id].teams[team_name].length < rooms[room_id].config.max_perTeam
  ) {
    //if user passes a team and that team exist and there is space in that team
    rooms[room_id].teams[team_name].push(userName);
  } else {
    //else bench the user
    team_name = "";
    rooms[room_id].state.bench.push(userName);
  }

  //user has been added to bench or a Team
  rooms[room_id].state.cur_memCount += 1;
  rooms[room_id].state.profilePictures.userName = profilePicture;
  return { status: 2, returnObj: rooms[room_id] };
};

/**
 *
 * @param {object} user -  { userName, room_id, team_name }
 * @returns {object} - { status , err }
 *                     0 - Can't kick , He's Admin
 *                     1 - if user is in a team.
 *                     2 - user is only in the bench
 * TODO : test this function
 * ! Should'nt be integrated without testing
 */
const removeUserFromRoom = (user) => {
  const { userName, room_id, team_name } = user;

  // if user is a admin then no leave only delete possible
  // it cause of the way i am storing room_id ( == adminName)
  if (rooms[room_id].config.admin === userName) {
    return { status: 0, error: "The User is admin. Can't kick admin." };
  }

  let status = undefined;
  if (team_name) {
    // if user has joined a team
    let newTeam = rooms[room_id].teams[team_name].filter(
      (ele) => ele !== userName
    );
    rooms[room_id].teams[team_name] = newTeam;
    status = 1;
    // no need to send team_name as this will only be sent to
    // ppl in "same team"
  } else {
    // if user is on a bench
    let newBench = rooms[room_id].state.bench.filter((ele) => ele !== userName);
    rooms[room_id].state.bench = newBench;
    status = 2;
  }

  // removed
  rooms[room_id].state.cur_memCount -= 1;

  return { status, returnObj: rooms[room_id] };
};

const joinTeam = (user, team_name) => {
  const { userName } = user;
  room = rooms[user.room_id];
  // only run if user and room exits and user is in that room
  // and there is space
  if (
    !room &&
    !room.teams[team_name] &&
    room.teams[team_name].length > room.config.max_perTeam
  ) {
    return {
      status: 0,
      error: "The User doesn't meet the specifications to join the team",
    };
  }
  if (user.team_name) {
    //ditch prev team
    return { status: 0, error: "Already in team" };
  }

  // remove from bench
  let newBench = rooms[user.room_id].state.bench.filter(
    (ele) => ele != userName
  );
  rooms[user.room_id].state.bench = newBench;

  //in new team
  rooms[user.room_id].teams[team_name].push(userName);

  return { status: 1, returnObj: rooms[user.room_id].teams[team_name] };
};

const closeRoom = (user, forceCloseRoom = false) => {
  const { room_id, userName } = user;
  const room = rooms[room_id];

  if (!room && room.config.admin !== userName) {
    return {
      status: 0,
      error: "The User doesn't meet the specifications to close the room",
    };
  }
  if (
    !forceCloseRoom &&
    (room.competition.contestOn || room.competition.veto.vetoOn)
  ) {
    return {
      status: 0,
      error: "There is a ongoing competition. Finish it first",
    };
  }
  // everyone from room bench
  let allMembers = rooms[room_id].state.bench;
  // from all teams
  Object.keys(rooms[room_id].teams).forEach((team_name) => {
    rooms[room_id].teams[team_name].forEach((user) => {
      allMembers.push(user);
    });
  });
  // delete the stupid room
  delete rooms[room_id];
  return { status: 1, returnObj: allMembers };
};

/*status :0 -> false
status :1 -> true
*/

const createTeam = (user, team_name) => {
  // if more teams are allowed
  //if team_name is not already used
  // and user is admin
  const { userName, room_id } = user;
  // if user not in room or not admin of the room
  const room = rooms[room_id];
  if (!room_id || room.config.admin !== userName) {
    return { status: 0, error: "Only admin can do this" };
  }
  if (
    Object.keys(room.teams).length > room.config.max_teams &&
    room.teams[team_name]
  ) {
    return {
      status: 0,
      error: "The team name has already been alloted or the team is already in",
    };
  }
  room.teams[team_name] = [];
  return { status: 1, returnObj: rooms[room_id].teams };
};

const leaveTeam = (user) => {
  const { room_id, team_name, userName } = user;
  const room = rooms[room_id];

  // check if in a room and in a team
  if (!room_id && !team_name) {
    return {
      status: 0,
      error: "User does not meet the specifications to leave the team",
    };
  }

  let newTeam = room.teams[team_name].filter((ele) => ele !== userName);
  room.teams[team_name] = newTeam;
  room.state.bench.push(userName);

  return { status: 1, returnObj: newTeam };
};

const addPrivateList = (user, privateList) => {
  const { userName, room_id } = user;
  const room = rooms[room_id];

  if (!room && room.config.admin !== userName && !room.config.privateRoom) {
    return { status: 0, error: "Only admin can do this" };
  }
  privateList.forEach((ele) => {
    if (!room.state.privateList.includes(ele)) {
      rooms[room_id].state.privateList.push(ele);
    }
  });
  return { status: 1, returnObj: rooms[room_id].state.privateList };
};

const getRoomData = (user, rooms_id) => {
  const { room_id } = user;

  if (room_id !== rooms_id) return { status: 0, error: "User not in room" };
  return { status: 1, returnObj: rooms[room_id] };
};

module.exports = {
  createRoom,
  joinRoom,
  removeUserFromRoom,
  joinTeam,
  closeRoom,
  createTeam,
  addPrivateList,
  createRoom,
  joinRoom,
  removeUserFromRoom,
  joinTeam,
  closeRoom,
  createTeam,
  leaveTeam,
  getRoomData,
};
