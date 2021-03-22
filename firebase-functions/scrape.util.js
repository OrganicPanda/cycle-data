const waitFor = (page, selector) =>
  page.waitForSelector(selector, {
    visible: true,
    timeout: 100000,
  });

const waitForText = (page, selector, text) =>
  page.waitForFunction(
    (selector, text) =>
      [...document.querySelectorAll(selector)].some(
        (el) => el.innerText === text
      ),
    {},
    selector,
    text
  );

const getText = (page, selector) =>
  page.evaluate(
    (selector) => document.querySelector(selector).innerText,
    selector
  );

const waitForTextStartsWith = (page, selector, text) =>
  page.waitForFunction(
    (selector, text) =>
      [...document.querySelectorAll(selector)].some((el) =>
        el.innerText.startsWith(text)
      ),
    {},
    selector,
    text
  );

const waitForTextChange = (page, selector, previousText) =>
  page.waitForFunction(
    (selector, previousText) =>
      [...document.querySelectorAll(selector)].some(
        (el) => el.innerText && el.innerText !== previousText
      ),
    {},
    selector,
    previousText
  );

const clickOnText = (page, selector, text) =>
  page.evaluate(
    (selector, text) => {
      [...document.querySelectorAll(selector)]
        .filter((el) => el.innerText === text)[0]
        .click();
    },
    selector,
    text
  );

const clickOnFirst = (page, selector) =>
  page.evaluate((selector) => {
    const matches = [...document.querySelectorAll(selector)];

    matches[0].click();
  }, selector);

const clickOnLast = (page, selector) =>
  page.evaluate((selector) => {
    const matches = [...document.querySelectorAll(selector)];

    matches[matches.length - 1].click();
  }, selector);

const findColumnIndexByHeaderText = (page, tableSelector, headerText) =>
  page.evaluate(
    (tableSelector, headerText) => {
      const tableRows = [...document.querySelectorAll(`${tableSelector} > tr`)];
      const headerCells = [...tableRows[0].querySelectorAll("td")];

      return headerCells.reduce((current, cell, i) =>
        cell.innerText === headerText ? i : current
      );
    },
    tableSelector,
    headerText
  );

const getTableRowData = (page, tableSelector, cellZeroText) =>
  page.evaluate(
    (tableSelector, cellZeroText) => {
      const tableRows = [...document.querySelectorAll(`${tableSelector} > tr`)];

      const matchedRow = tableRows.find((row) => {
        const cells = [...row.querySelectorAll("td")];

        if (!cells || !cells[0]) return false;

        return cells[0].innerText === cellZeroText;
      });

      if (!matchedRow) return null;

      return [...matchedRow.querySelectorAll("td")].map(
        (cell) => cell.innerText
      );
    },
    tableSelector,
    cellZeroText
  );

module.exports = {
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
};
