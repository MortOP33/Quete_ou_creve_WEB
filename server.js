const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');

app.use(express.static(path.join(__dirname, 'public')));

let game = {};
let players = {};
let sabotage = null;

function resetGame() {
  game = {
    started: false,
    innocents: 0,
    assassins: 0,
    hacker: 0,
    necromancien: 0,
    innocentsDead: 0,
    assassinsDead: 0,
    hackerDead: 0,
    necromancienDead: 0,
    sabotage: false,
    sabotageId: 0,
    sabotageDuration: 40,
    sabotageCD: 60,
    sabotageDelay: 10,
    sabotageSyncWindow: 1
  };
  players = {};
  sabotage = {
    timer: null,
    endTime: null,
    clicks: [],
    actif: false,
    id: 0,
    preparing: false,
    prepareTimer: null,
    prepareEndTime: null,
    lastSabotageEnd: 0
  };
}
resetGame();

function emitState() {
  io.emit('state', {
    assassins: game.assassins,
    innocents: game.innocents,
    hacker: game.hacker,
    necromancien: game.necromancien,
    assassinsDead: game.assassinsDead,
    innocentsDead: game.innocentsDead,
    hackerDead: game.hackerDead,
    necromancienDead: game.necromancienDead,
    started: game.started,
    sabotage: sabotage.actif
  });
}

function checkEndGame() {
  if (game.assassinsDead >= game.assassins && game.assassins > 0) {
    io.emit('end', {winner: 'innocents'});
    emitState();
    return true;
  }
  if (game.innocentsDead + game.hackerDead + game.necromancienDead >= game.innocents + game.hacker + game.necromancien && game.innocents + game.hacker + game.necromancien  > 0) {
    io.emit('end', {winner: 'assassins'});
    emitState();
    return true;
  }
  return false;
}

io.on('connection', (socket) => {
  socket.on('setRole', ({role}) => {
    if (['maitre', 'innocent', 'assassin','hacker','necromancien'].includes(role)) {
      players[socket.id] = {role, mort: false};
    }
  });

  socket.on('start', ({
    assassins, innocents, hacker, necromancien,
    sabotageDuration, sabotageCD, sabotageDelay, sabotageSyncWindow
  }) => {
    game.started = true;
    game.assassins = parseInt(assassins, 10) || 1;
    game.innocents = parseInt(innocents, 10) || 1;
    game.hacker = parseInt(hacker, 10) || 1;
    game.necromancien = parseInt(necromancien, 10) || 1;
    game.assassinsDead = 0;
    game.innocentsDead = 0;
    game.hackerDead = 0;
    game.necromancienDead = 0;
    if (sabotageDuration) game.sabotageDuration = sabotageDuration;
    if (sabotageCD) game.sabotageCD = sabotageCD;
    if (sabotageDelay) game.sabotageDelay = sabotageDelay;
    if (sabotageSyncWindow) game.sabotageSyncWindow = sabotageSyncWindow;
    Object.keys(players).forEach(id => players[id].mort = false);
    sabotage.lastSabotageEnd = 0;
    sabotage.preparing = false;
    if (sabotage.prepareTimer) clearTimeout(sabotage.prepareTimer);
    emitState();
  });

  socket.on('reset', () => {
    resetGame();
    io.emit('reset');
    emitState();
  });

  socket.on('dead', ({role: r}) => {
    if (!players[socket.id] || players[socket.id].mort) return;
    players[socket.id].mort = true;
    if (players[socket.id].role === "innocent") {
      game.innocentsDead++;
    } else if (players[socket.id].role === "assassin") {
      game.assassinsDead++;
    } else if (players[socket.id].role === "hacker") {
      game.hackerDead++;
    } else if (players[socket.id].role === "necromancien") {
      game.necromancienDead++;
    }
    checkEndGame();
    emitState();
  });

  socket.on('innocents_win', () => {
    io.emit('end', {winner: 'innocents'});
    emitState();
  });

  socket.on('prepare_sabotage', () => {
    const now = Date.now();
    if (!game.started || sabotage.actif || sabotage.preparing) return;
    if (!players[socket.id] || players[socket.id].role !== 'assassin' || players[socket.id].mort) return;
    // CD entre sabotages
    if (sabotage.lastSabotageEnd && now - sabotage.lastSabotageEnd < game.sabotageCD * 1000) return;
    sabotage.preparing = true;
    sabotage.prepareEndTime = now + game.sabotageDelay * 1000;
    io.emit('sabotageDelay', {delay: game.sabotageDelay});
    sabotage.prepareTimer = setTimeout(() => {
      sabotage.preparing = false;
      sabotage.prepareTimer = null;
      sabotageStart(game.sabotageDuration);
    }, game.sabotageDelay * 1000);
  });

  socket.on('sabotage', () => {
    // Jamais utilisé directement sauf compatibilité, on applique la logique du CD et du délai !
    const now = Date.now();
    if (!game.started || sabotage.actif || sabotage.preparing) return;
    if (!players[socket.id] || players[socket.id].role !== 'assassin' || players[socket.id].mort) return;
    if (sabotage.lastSabotageEnd && now - sabotage.lastSabotageEnd < game.sabotageCD * 1000) return;
    sabotageStart(game.sabotageDuration);
  });

  function sabotageStart(duration) {
    sabotage.actif = true;
    sabotage.endTime = Date.now() + (duration || game.sabotageDuration) * 1000;
    sabotage.clicks = [];
    sabotage.id += 1;
    io.emit('sabotageStart', {duration: (duration || game.sabotageDuration)});
    emitState();
    if (sabotage.timer) clearInterval(sabotage.timer);
    sabotage.timer = setInterval(() => {
      let remaining = Math.max(0, Math.floor((sabotage.endTime - Date.now())/1000));
      io.emit('sabotageTimer', {seconds: remaining});
      if (remaining <= 0) {
        clearInterval(sabotage.timer);
        sabotage.timer = null;
        sabotage.actif = false;
        sabotage.lastSabotageEnd = Date.now();
        io.emit('sabotageFailed');
        io.emit('end', {winner: 'assassins'});
        emitState();
      }
    }, 1000);
  }

  socket.on('desamorcage', () => {
    if (!sabotage.actif) return;
    if (!players[socket.id] || players[socket.id].mort) return;
    let now = Date.now();
    // On laisse chaque joueur cliquer, mais on ne garde que les 2 derniers clics
    sabotage.clicks.push({id: socket.id, at: now});
    if (sabotage.clicks.length > 2) sabotage.clicks.shift();
    if (sabotage.clicks.length === 2) {
      const [a, b] = sabotage.clicks;
      if (a.id !== b.id && Math.abs(a.at - b.at) <= (game.sabotageSyncWindow || 1) * 1000) {
        clearInterval(sabotage.timer);
        sabotage.timer = null;
        sabotage.actif = false;
        sabotage.lastSabotageEnd = Date.now();
        io.emit('sabotageStopped');
        emitState();
      }
    }
  });

  socket.on('disconnect', () => {
    delete players[socket.id];
    emitState();
  });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
  console.log('Serveur lancé sur http://localhost:' + PORT);
});