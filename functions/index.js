const request = require('request');
const RIOT_KEY = require("./api_key.json").riot;
const BASE_URL = "https://na1.api.riotgames.com";
const fetch = require('node-fetch');

process.env.DEBUG = 'actions-on-google:*';
const DialogflowApp = require('actions-on-google').DialogflowApp;
const functions = require('firebase-functions');

const GET_ID = "GET_ID";
const SET_NAME = "SET_NAME";
const GET_LEVEL = "GET_LEVEL";
const GET_RANK = "GET_RANK";
const GET_STAT = "GET_STAT";
const GET_MASTERY = "GET_MASTERY";
const LAST_MATCH = "LAST_MATCH";
const VIEW_ALLY = "VIEW_ALLY";
const VIEW_ENEMY = "VIEW_ENEMY";


const NAME_ARGUMENT = "name";

exports.league_assistant = functions.https.onRequest((req, response) => {
  const app = new DialogflowApp({request: req, response: response});
  console.log('Request headers: ' + JSON.stringify(req.headers));
  console.log('Request body: ' + JSON.stringify(req.body));
  console.log(JSON.stringify(app.body_));
  app.body_ = req.body;
  console.log(JSON.stringify(app.body_));

// === HELPERS ===

// makeUrl: Takes an endpoint (found on Riot API site) and returns the
//          url to make a request, attaching the api key
function makeUrl (endpoint) {
    return BASE_URL + endpoint + "?api_key=" + RIOT_KEY;
}

//entry point, set the current summoner as stringified object
// ex:{"id":70259813,"accountId":230246230,"name":"wisteria dream","profileIconId":3024,"revisionDate":1516432408000,"summonerLevel":54}
function setName(app) {
  let summonerName = app.getArgument(NAME_ARGUMENT);
  let callback = (obj => {
    console.log(obj);
    app.data.summoner = obj;
    app.ask({speech: `Now working with ${app.data.summoner.name}`,
              displayText: `Current summoner is set to ${app.data.summoner.name}`});
  });
  let url = makeUrl(`/lol/summoner/v3/summoners/by-name/${summonerName}`); 
  request({url: url}, function (error, response, body) {
      let obj = JSON.parse(body);
      callback(obj);
  });
}
// getIdFromName: Given a summoner name, returns the summoner id
function getIdFromName(app) {
    app.ask(`Your summoner ID is: ${app.data.summoner.id}`);
}

function getLevel(app) {
    app.ask(`Your current summoner level is: ${app.data.summoner.summonerLevel}`);
}






// async function getIdFromName(app) {
//     let summonerName = app.getArgument(NAME_ARGUMENT);
//     let url = makeUrl(`/lol/summoner/v3/summoners/by-name/${summonerName}`);
//     let req = await fetch(url).then(function(res) {
//         return res.json();
//     }).then(function(json) {
//         console.log(json.id);
//         app.tell(`Your ID is: ${json.id}`);
//     });
// }

// romanToNumeric: Turns roman numeral to speakable numeric numbers
function romanToNumeric(roman) {
    let romanMap = { "I" : 1, "II" : 2, "III" : 3, "IV" : 4, "V" : 5};
    return romanMap[roman];
}

// winRate: Returns the winrate
function winRate (wins, losses) {
    return losses == 0? "100 percent" : parseInt(( (wins/(wins+losses))+0.005)*100) + " percent";
}


// === API === 
// function getRankedByName(summonerName, callback) {
//     getIdFromName(summonerName, (summonerId) => {
//         getPositionsById(summonerId, callback);
//     })
// }

// getPositionsById: Returns the ranked stats for a summoner
//                   Stats include Rank, Wins, Losses, Win Streak and Veteran
function getRank(app) {
    let callback = (obj => app.ask(`Rank is ${obj.tier + " " + romanToNumeric(obj.rank)}`));
    let url = makeUrl(`/lol/league/v3/positions/by-summoner/${app.data.summoner.id}`);
    request(url, function (error, response, body) {
        try {
          let obj = JSON.parse(body)[0];
          callback(obj);
        } catch (e) {
           app.ask("You are unranked!!");
           return;
        }
        //console.log("body: ",body);
        //console.log("object: ", obj);
    });
}

function getStat(app) {
   let callback = (obj => app.ask(`You are ${obj.tier + " " + romanToNumeric(obj.rank)} with 
    ${winRate(obj.wins, obj.losses)} win rate, winstreak: ${obj.hotStreak}, veteran: ${obj.veteran}`));
   let url = makeUrl(`/lol/league/v3/positions/by-summoner/${app.data.summoner.id}`);
   request(url, function (error, response, body) {
        try {
          let obj = JSON.parse(body)[0];
          callback(obj);
        } catch (e) {
           app.ask("You are unranked!!");
           return;
        }
        //console.log("body: ",body);
        //console.log("object: ", obj);
    });
}

function getMastery(app) {
  let callback = (obj => app.ask(`Champion ${obj.championId} with ${obj.championPoints} points`));
  let url = makeUrl(`/lol/champion-mastery/v3/champion-masteries/by-summoner/${app.data.summoner.id}`);
  request({url: url}, function (error, response, body) {
      let obj = JSON.parse(body)[0];
      callback(obj);
  });
}

function lastMatch(app) {
  let callback = (obj => app.ask(`In your last match, you played ${obj.queue} in the ${obj.lane} lane
     with ${obj.champion} as ${obj.role} `));
  let url = makeUrl(`/lol/match/v3/matchlists/by-account/${app.data.summoner.accountId}`);
  request({url: url}, function (error, response, body) {
      let obj = JSON.parse(body).matches[0];
      callback(obj);
  });
}

function getRankedById(id) {
    let callback = (obj => 
      app.ask(`${obj.playerOrTeamName}, rank ${obj.tier + " " + romanToNumeric(obj.rank)}, winrate ${winRate(obj.wins, obj.losses)} ~ `));
    let url = makeUrl(`/lol/league/v3/positions/by-summoner/${id}`);
    request(url, function (error, response, body) {
        try {
          let obj = JSON.parse(body)[0];
          callback(obj);
        } catch (e) {
           app.ask("unranked player");
           return;
        }
        //console.log("body: ",body);
        //console.log("object: ", obj);
    });
}

// getCurrentGame: Returns data on the game the summoner is currently playing
//                 Refer to currentGame.json
function getCurrentGame(app) {
    let callback = (obj => obj);
    let url = makeUrl(`/lol/spectator/v3/active-games/by-summoner/${app.data.summoner.id}`);
    request(url, function (error, response, body) {
          obj = JSON.parse(body);
          console.log(obj);
          console.log(obj.status.message);
          if (!obj.participants) {
            app.ask(`${app.data.summoner.name} is not currently in game!`);
            return 404;
          } else {
        //console.log("body: ",body);
        //console.log("object: ", obj);
              callback(obj);
          }});
}

// ACTION MAP
// 

// viewTeam: Returns simplified ranked stats of summoner's allied or enemy team
//           viewAlly is a boolean
function viewOwnTeam(app) {
      let callback = (obj => {
        if (!obj.participants) {
          app.ask("You are not in game!!");
        } else {
          let ppl = [];
          obj.participants.forEach((summoner) => {
            if (summoner.teamId === 100 && summoner.summonerName != app.data.summoner.name) ppl.push(summoner.summonerName);
          });
          app.ask(`You are playing with: ${ppl}`);
    //  obj.participants.forEach( (summoner) => {
     //   if (summoner.teamId === 100) {
    //        getRankedById(summoner.summonerId);
    //        app.ask(`${summoner.summonerName}, `);
  }});
     let url = makeUrl(`/lol/spectator/v3/active-games/by-summoner/${app.data.summoner.id}`);
     request(url, function (error, response, body) {
          obj = JSON.parse(body);
          callback(obj);
        });
   }
    


function viewEnemyTeam(app) {
      let callback = (obj => {
        if (!obj.participants) {
          app.ask("You are not in game!!");
        } else {
          let ppl = [];
          obj.participants.forEach((summoner) => {
            if (summoner.teamId === 200) ppl.push(summoner.summonerName);
          });
          app.ask(`You are playing against: ${ppl}`);
    //  obj.participants.forEach( (summoner) => {
     //   if (summoner.teamId === 200) {
    //        getRankedById(summoner.summonerId);
    //        app.ask(`${summoner.summonerName}, `);
  }});
     let url = makeUrl(`/lol/spectator/v3/active-games/by-summoner/${app.data.summoner.id}`);
     request(url, function (error, response, body) {
          obj = JSON.parse(body);
          callback(obj);
        });
   }

// winStreak: Returns an array of all the players currently on a winstreak
function winStreak(user, callback) {
    let players = []
    let itemsProcessed = 0;

    getCurrentGame(user, (gameData) => {
        if (gameData.participants) {

            gameData.participants.forEach( (summoner) => {
                getRankedById(summoner.summonerId, (stats) => {
                    // This summoner name from the group of 10 is not the user
                    if (stats && stats.hotStreak) {
                        players.push(summoner.summonerName);
                    }

                    itemsProcessed++;
                    if (itemsProcessed == gameData.participants.length) {
                        if (players.length == 0) {
                            callback("No one is on a winning streak");
                        } else if (players.length == 1) {
                            callback(players.toString() + "is on a winning streak");
                        } else {
                            callback(players.toString() + "are on winning streaks");                            
                        }
                    }
                })
            })
        } else {
            callback(`${user} is currently not in game`);            
        }
    })
}

// viewTeam("imaqtpie",false, (re) => {
//     console.log(re);
// });

let actionMap = new Map();
  actionMap.set(SET_NAME, setName);
  actionMap.set(GET_ID, getIdFromName);
  actionMap.set(GET_LEVEL, getLevel);
  actionMap.set(GET_RANK, getRank);
  actionMap.set(VIEW_ALLY, viewOwnTeam);
  actionMap.set(VIEW_ENEMY, viewEnemyTeam);
  actionMap.set(GET_STAT, getStat);
  actionMap.set(GET_MASTERY, getMastery);
  actionMap.set(LAST_MATCH, lastMatch);

console.log(app);
console.log(typeof app);
console.log(JSON.stringify(app.body_));
console.log(JSON.stringify(app.body_.result));
console.log(JSON.stringify(app.getIntent_()));
console.log(app.getIntent());

app.handleRequest(actionMap);
});
// winStreak("KiNG Nidhogg", (re) => {
//     console.log(re);
// })

// winStreak(user)

//getCurrentGame("nightblue3", (val)=> console.log("[getCurrentGame] Top level:", JSON.stringify(val,null,2)));
