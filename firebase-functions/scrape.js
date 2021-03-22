const functions = require("firebase-functions");
const puppeteer = require("puppeteer");
const parse = require("date-fns/parse");
const format = require("date-fns/format");
const { db } = require("./firestore");
const {
  waitFor,
  waitForText,
  getText,
  waitForTextStartsWith,
  waitForTextChange,
  clickOnText,
  clickOnFirst,
  clickOnLast,
  findColumnIndexByHeaderText,
  getTableRowData,
} = require("./scrape.util");

async function* classBreakdownSequence(page) {
  while (true) {
    try {
      const stringContainingDate = await getText(page, "#reptitle2");
      const date = parse(
        stringContainingDate.match(/([\d]+ [\w]+ [\d]+$)/)[0],
        "dd LLLL yyyy",
        new Date()
      );
      const formattedDate = format(date, "yyyy-LL-dd");

      const columnsOfInterest = [
        "Bin 1 M/Cycle",
        "Bin 2 Car/lVan",
        "Bin 3 Cr/lV+Tr",
        "Bin 4 H. Van",
        "Bin 5 LGV",
        "Bin 6 Rigid",
        "Bin 7 Rg+Tr",
        "Bin 8 ArticHGV",
        "Bin 9 Minibus",
        "Bin 10 Bus",
        "Bin 11 Cycle",
      ];

      const rowData = await getTableRowData(
        page,
        "#dataContent table",
        "24H(0-24)"
      );

      const dataByBin = {};

      for (const columnOfInterest of columnsOfInterest) {
        const columnIndex = await findColumnIndexByHeaderText(
          page,
          "#dataContent table",
          columnOfInterest
        );

        const data = Number.parseInt(rowData[columnIndex], 10);

        dataByBin[columnOfInterest] = data;
      }

      yield { date, dataByBin };

      const canKeepGoing = !(await page.$eval(
        "button#moveRight",
        (el) => el.disabled
      ));

      if (!canKeepGoing) break;

      await page.click("button#moveRight");
      await waitForTextChange(page, "#reptitle2", stringContainingDate);

      const newStringContainingDate = await getText(page, "#reptitle2");
    } catch (e) {
      console.error("error in classBreakdownSequence - exiting");
      console.error(e);
      break;
    }
  }
}

const selectClassBreakdown = async (popup) => {
  await waitFor(popup, "button#classbut");
  await waitForTextStartsWith(popup, "#reptitle2", "Vehicle Count Report");

  await popup.click("button#classbut");
  await waitForTextStartsWith(popup, "#reptitle2", "Classification Report");
};

async function* speedBreakdownSequence(page) {
  while (true) {
    try {
      const stringContainingDate = await getText(page, "#reptitle2");
      const date = parse(
        stringContainingDate.match(/([\d]+ [\w]+ [\d]+$)/)[0],
        "dd LLLL yyyy",
        new Date()
      );
      const formattedDate = format(date, "yyyy-LL-dd");

      const columnsOfInterest = [
        "Total Volume",
        "85th Percentile",
        "Mean Average",
        "Standard Deviation",
        "<5Mph",
        "5-<10",
        "10-<15",
        "15-<20",
        "20-<25",
        "25-<30",
        "30-<35",
        "35-<40",
        "40-<45",
        "45-<50",
        "50-<55",
        "55-<60",
        "=>60",
      ];

      const rowData = await getTableRowData(
        page,
        "#dataContent table",
        "24H(0-24)"
      );

      const dataByColumn = {};

      for (const columnOfInterest of columnsOfInterest) {
        const columnIndex = await findColumnIndexByHeaderText(
          page,
          "#dataContent table",
          columnOfInterest
        );

        const data = Number.parseFloat(rowData[columnIndex]);

        dataByColumn[columnOfInterest] = data;
      }

      yield { date, dataByColumn };

      const canKeepGoing = !(await page.$eval(
        "button#moveRight",
        (el) => el.disabled
      ));

      if (!canKeepGoing) break;

      await page.click("button#moveRight");
      await waitForTextChange(page, "#reptitle2", stringContainingDate);

      const newStringContainingDate = await getText(page, "#reptitle2");
    } catch (e) {
      console.error("error in speedBreakdownSequence - exiting");
      console.error(e);
      break;
    }
  }
}

const selectSpeedBreakdown = async (popup) => {
  await waitFor(popup, "button#speedbut");
  await waitForTextStartsWith(popup, "#reptitle2", "Vehicle Count Report");

  await popup.click("button#speedbut");
  await waitForTextStartsWith(popup, "#reptitle2", "Speed Report");
};

exports.scrape = functions
  .region("europe-west2")
  .runWith({
    timeoutSeconds: 540,
    memory: "1GB",
  })
  .https.onRequest(async (request, response) => {
    const timeout = 10 * 1000;
    const browser = await puppeteer.launch({
      defaultViewport: {
        width: 1920,
        height: 1080,
        deviceScaleFactor: 1,
      },
    });

    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(timeout);
    page.setDefaultTimeout(timeout);
    let popup;
    let outputScreenshot;

    try {
      await page.goto("http://wstrafficdata.cdmf.info/Account/login");

      await waitFor(page, "#MainContent_Email");
      await page.type(
        "#MainContent_Email",
        functions.config().wstrafficdata.username
      );
      await page.type(
        "#MainContent_Password",
        functions.config().wstrafficdata.password
      );
      await page.click('input[type="submit"]');

      await waitFor(page, "#menucontainer");
      await page.click(
        '#menucontainer a[href="/VDAForms/TMSiteForms/TMSiteList"]'
      );

      await waitFor(page, "#TextFilter");

      const siteId = "00000093"; // Shoreham cycle lane ID
      await page.type("#TextFilter", siteId);

      await waitForText(page, "#siteListContent td", siteId);
      await clickOnText(page, "#siteListContent td", siteId);

      await waitFor(page, "#calendarContent");
      await waitForText(page, "#yearVal", "2021");

      // go back to 2020
      // await waitFor(page, 'button[onclick="yearMinus()"]')
      // page.click('button[onclick="yearMinus()"]')
      // await waitForText(page, '#yearVal', '2020')

      await waitFor(page, "td.caldaysel");
      // await clickOnFirst(page, 'td.caldaysel')
      await page.click("td#Cal_3_19"); // Note: no leading zeros on these digits
      await clickOnLast(page, "td.caldaysel");

      // This is quite a weird dance but it's the easiest way to get the popup instance
      const [popupInstance] = await Promise.all([
        new Promise((resolve) => page.once("popup", resolve)),
        page.click("button#LoadSelection"),
      ]);

      popup = popupInstance;
      popup.setDefaultNavigationTimeout(timeout);
      popup.setDefaultTimeout(timeout);

      await selectClassBreakdown(popup);
      // await selectSpeedBreakdown(popup)

      let generator = classBreakdownSequence(popup);
      // let generator = speedBreakdownSequence(popup)

      const promises = [];
      for await (let { date, dataByBin: data } of generator) {
        console.log(date, data);

        // Kick off the queries whilst we are waiting for pages to load
        promises.push(
          db
            .collection(`sites/${siteId}/datasets/FLOW/daily`)
            .doc(format(date, "yyyy-LL-dd"))
            .set({
              data,
              date,
            })
        );
      }

      const results = await Promise.allSettled(promises);

      console.log("Scrape finished:");
      console.log(results);

      outputScreenshot = await popup.screenshot();
    } catch (e) {
      console.error("Scrape error:", e);
      outputScreenshot = await page.screenshot();
    } finally {
      if (browser) {
        await browser.close();
      }
      if (outputScreenshot) {
        return response.type("image/png").send(outputScreenshot);
      }

      response.json({});
    }
  });
