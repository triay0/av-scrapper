var Nightmare = require('nightmare');
const fs = require('fs');
var express = require("express"),
  app = express();


  app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Headers', 'Authorization, X-API-KEY, Origin, X-Requested-With, Content-Type, Accept, Access-Control-Allow-Request-Method');
      res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
      res.header('Allow', 'GET, POST, OPTIONS, PUT, DELETE');

      next();
  });
const url = 'http://arenavision.us/';

var selectorEvents = "table";
var selectorChannels = "ul.menu > li.expanded > ul.menu > li > a";

const nightmare = Nightmare({
  show: false,
  executionTimeout: 100000,
  gotoTimeout: 100000,
  loadTimeout: 100000,
  waitTimeout: 100000
});

async function getChannels() {
  var links = [];
  var channels = await nightmare
    .goto(url)
    .wait(selectorChannels)
    .evaluate(
      function() {
        return Array.from(document.querySelectorAll('ul.menu > li.expanded > ul.menu > li > a')).map(element => element.href);
      }, selectorChannels);

  for (var i = 0; i < channels.length; i++) {
    var chanAux = await getChannelLink(channels[i]);
    if (chanAux != null) {
      links.push(chanAux);
    }
  }

  fs.writeFile("./tmp/channels.json", JSON.stringify(links), function(err) {
    if (err) {
      return console.log(err);
    }
    console.log("Channels saved!");

    return true;
  });
}

async function getChannelLink(url) {
  var channelNo = url.split("?"); // Number of the channel extracted from the HTML
  channelNo = channelNo[0].split("/");
  channelNo = channelNo[channelNo.length - 1];

  var channels = await nightmare
    .goto(url)
    // .wait(a)
    .evaluate(
      function() {
        return Array.from(document.querySelectorAll('a')).map(element => element.href);
      }, selectorChannels);

  var channel = "";

  if (channels.find(x => x.includes('acestream://')) == undefined) {
    return null;

  }
  var channel = channels.find(x => x.includes('acestream://'));
  var ch = {
    id: parseInt(channelNo),
    link: channel
  };
  return ch;
}

// GET GUIDE FROM ARENAVISION.US AND SAVE CLEAN JSON
async function getEvents() {

  const channels = JSON.parse(fs.readFileSync("./tmp/channels.json", 'utf8'));

  var cleanEvents = [];
  const result = nightmare
    .goto(url + "/guide")
    .wait(selectorEvents)
    .evaluate(selectorEvents => {
      return {
        table: document.querySelector(selectorEvents).innerText
      };
    }, selectorEvents)
    .then(extracted => {
      var events = extracted.table.split("\n");
      for (var i = 1; i < events.length; i++) {
        var fields = events[i].split("\t");

        if (fields.length == 1) {

          var language = fields[0].substring(fields[0].lastIndexOf("[") + 1, fields[0].lastIndexOf("]"));
          fields[0] = fields[0].replace(/\[.*?\]\s?/g, '');
          var chann = fields[0].split("-");
          var chan = [];
          for (ch of chann) {
            // console.log(channels.find(x => x.id == ch).link);
            if ((channels.find(x => x.id == ch)) === undefined) {
              console.log(ch + " undefined");
            } else {
              chan.push({
                link: channels.find(x => x.id == ch).link,
                lang: language
              });
              cleanEvents[cleanEvents.length - 1].channel.push(chan[0]);
            }
          }
          continue;
        }

        var date = new Date();
        date.setDate(fields[0].toString().split("/")[0]);
        date.setMonth(fields[0].toString().split("/")[1]);
        date.setYear(fields[0].toString().split("/")[2]);
        date.setHours(fields[1].replace("CEST", "").split(":")[0]);
        date.setMinutes(fields[1].replace("CEST", "").split(":")[1]);
        var cestToUtc = fields[1].replace("CEST", "");

        var channel = fields[5];

        if (channel == undefined || channel.includes("undefined")) {
          // console.log(fields[4] + " " + channel);
          continue;
        }
        // console.log(fields[4] + " " +channel);
        var language = channel.substring(channel.lastIndexOf("[") + 1, channel.lastIndexOf("]"));
        channel = channel.replace(/\[.*?\]\s?/g, '');
        // console.log(channel);
        var chann = channel.split("-");

        var chan = [];
        for (ch of chann) {

          if ((channels.find(x => x.id == ch)) !== undefined) {

            chan.push({
              link: (channels.find(x => x.id == ch)).link,
              lang: language
            });
          }
        }

        var event = {
          date: date,
          sport: fields[2],
          competition: fields[3],
          event: fields[4],
          channel: chan
        };
        cleanEvents.push(event);

      }
      fs.writeFile("./tmp/guide.json", JSON.stringify(cleanEvents), function(err) {
        if (err) {
          return console.log(err);
        }
        console.log("Events saved!");

        return true;
      });
      // console.log(cleanEvents);
    });
}


function returnGuide(req, res){
  const guide = JSON.parse(fs.readFileSync("./tmp/guide.json", 'utf8'));
  res.status(200).send(guide);

}

app.get('/', function (req, res) {
  const guide = JSON.parse(fs.readFileSync("./tmp/guide.json", 'utf8'));
  res.status(200).send(guide);
});



const PORT = 8080;

// Start server
app.listen(PORT, function() {
  console.log("***Node server running on http://localhost:"+PORT+"***");
});


async function init() {
  await getChannels();
  await getEvents();
}

// init();
