const csv = require("csv-parser");
const fs = require("fs");
const { createCanvas } = require("canvas");
const { Chart } = require("chart.js");
const d3 = require("d3");
const axios = require("axios");
const { Octokit } = require("@octokit/rest");

// the plan!
// 1. get the data from GitHub (auth as the bot?)
// 2. save the charts in an img/ folder and add them to the readme
// 3. save the charts as base64 strings and pass to Slack for Home page

const key = process.env.GH_API_KEY;

if (typeof key === "undefined") {
  throw new Error(`need a valid github API key`);
}

const octokit = new Octokit({
  auth: key,
});

const createChartsForUser = async (user) => {
  const data = await getDataForUser(user);
  generateTimeline(data);
  console.log(data);
};

const getDataForUser = async (user = {}) => {
  const owner = user.ghuser || "githubocto";
  const repo = user.ghrepo || "good-day-demo";
  const path = "good-day.csv";

  let response = await octokit.repos.getContent({
    owner,
    repo,
    path,
  });

  const res = response.data;
  const content = "content" in res ? res.content : "";
  const contentBuffer = Buffer.from(content, "base64").toString("utf8");
  const data = d3.csvParse(contentBuffer);

  return data;
};

const generateTimeline = async (data) => {
  const width = 1200;
  const height = 350;

  const [date, ...fields] = Object.keys(data[0]).filter(Boolean);
  const startDate = new Date(data[0]["date"]);
  const field = fields[0];

  const config = {
    type: "line",
    data: {
      labels: data.map((d) => d3.timeFormat("%A")(new Date(d.date))),
      datasets: [
        {
          label: field,
          borderColor: `rgb(69, 174, 177)`,
          backgroundColor: `rgba(69, 174, 177, 0.1)`,
          pointBackgroundColor: `rgba(69, 174, 177, 1)`,
          pointRadius: 5,
          data: data.map((d) => +d[field]),
        },
      ],
    },
    options: {
      responsive: false,
      animation: false,
      plugins: {
        title: {
          display: true,
          padding: {
            bottom: 26,
          },
          font: {
            weight: 900,
          },
          text: `${field.replace(/_/g, " ")} (week of ${d3.timeFormat(
            "%B %-d, %Y"
          )(startDate)})`,
        },
        legend: {
          display: false,
        },
      },
      layout: {
        padding: { top: 30, right: 50, bottom: 30, left: 50 },
      },
      scales: {
        y: {
          min: 0,
          max: 5,
          stepSize: 1,
        },
      },
    },
    plugins: [
      {
        beforeDraw: (chart) => {
          ctx.fillStyle = "white";
          ctx.fillRect(0, 0, chart.width, chart.height);
        },
      },
    ],
  };

  const canvas = createCanvas(width, height);

  const ctx = canvas.getContext("2d");

  Chart.defaults.font = {
    family: "'Helvetica Neue', 'Helvetica', 'Arial', sans-serif",
    style: "normal",
    size: 18,
    lineHeight: 1.2,
    weight: 500,
  };

  const chart = new Chart(canvas, config);

  const imageData = canvas
    .toDataURL("image/png")
    .replace(/^data:image\/\w+;base64,/, "");

  await fs.writeFile(
    "/tmp/chart.png",
    imageData,
    { encoding: "base64" },
    (e) => {
      console.log(e);
    }
  );
};
createChartsForUser();
