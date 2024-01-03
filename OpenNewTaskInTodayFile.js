/**
 * Скрипт вставки задачи в ежедневную заметку
 * Добавление задачи происходит через диалоговое окно плагина Tasks
 * Можно использовать в QuickAdd или другом плагине, выполняющем js
 *
 * Новые задачи будут вставляться после текста, прописанного в константе headingText
 * Если текст указанный в константе headingText не будет найден, он тоже вставится
 *
 * Для работы необходимы плагины:
 * - Tasks
 * - Ежедневные заметки (встроенный)
 * - QuickAdd (опционально, для работы категорий)
 */

/**
 * Путь к заметке, содержащей категории, чтобы отключить категории, необходимо оставить пустым.
 * Пункты должны быть в формате списка
 */
const categoriesNoteName = "Главное/Категории задач.md";

const noCategoriesLabel = "-- без категории --"; // Название пункта меню для пропуска категории
const cancelLabel = " -- отменить --"; // Название пункта меню для отмены создания задачи
const addCategoryLabel = "-- добавить категорию --"; // Название пункта меню для создания категории

const listItemSign = "- "; // Пункт в списке категорий

module.exports = async () => {
  // Настраиваемые параметры
  const headingText = "## Задачи"; // Текст, после которого вставится задача
  const isOpenNote = false; // Открывать файл заметки при вставке задачи

  // Выбранная категория
  let pickedCategory = await getCategoryFromMenu();

  if (pickedCategory === undefined) {
    return;
  }

  const tasksApi = app.plugins.plugins["obsidian-tasks-plugin"].apiV1;
  let taskLine = await tasksApi.createTaskLineModal();

  // Если не заполнили задачу, то выходим
  if (!taskLine) {
    return;
  }

  // Добавляем категорию к задаче
  if (pickedCategory !== "" && pickedCategory !== noCategoriesLabel) {
    taskLine += ` [:: ${pickedCategory}]`;
  }

  let file;
  const dailyNotesPlugin = app.internalPlugins.plugins["daily-notes"];

  if (isOpenNote) {
    // Открытие ежедневной заметки  в редакторе
    await dailyNotesPlugin.commands
      .find((c) => c.id == "daily-notes")
      ?.callback();

    file = app.workspace.getActiveFile();
  } else {
    // Получение файла заметки без изменений в интерфейсе
    const todayNote = await dailyNotesPlugin.instance.getDailyNote();
    file = app.vault.getAbstractFileByPath(todayNote.path);
  }

  let content = await app.vault.read(file);
  let headingIndex = content.indexOf(headingText);

  // Если в наметке не найден заголовок
  if (headingIndex === -1) {
    // Отступ от предыдущего контента в одну строку, если он есть и это не frontmatter
    if (content.length && "---\n" !== content.slice(-4)) {
      const lineBreakCount = (content.match(/\n+$/) || [""])[0].length;

      for (let index = 0; index < 2 - lineBreakCount; index++) {
        content += "\n";
      }
    }

    // Вставка заголовка
    content += headingText;
    headingIndex = content.length;
  }

  let insertPosition = headingIndex + headingText.length;

  const taskSign = "- [";
  // Присутствуют ли другие задачи
  const isBeforeTask =
    content.slice(insertPosition + 2, insertPosition + 5) === taskSign;

  insertPosition += isBeforeTask ? 1 : 0;

  // Вставка задачи в заметку
  content = [
    content.slice(0, insertPosition),
    "\n",
    isBeforeTask ? "" : "\n",
    taskLine,
    content.slice(insertPosition),
  ].join("");

  // Сохранение заметки
  app.vault.modify(file, content);

  // Всплывающее уведомление
  new Notice("Задача добавлена");
};

/**
 * Добавление категории в специальную заметку
 * @param {string} categoryName
 */
const createNewCategory = async (categoryName) => {
  const categoriesFile = app.vault.getAbstractFileByPath(categoriesNoteName);
  if (categoriesFile !== null) {
    let categoriesFileContent = await app.vault.read(categoriesFile);

    if (
      categoriesFileContent.substr(-1) !== "\n" &&
      categoriesFileContent.length
    ) {
      categoriesFileContent += "\n";
    }

    categoriesFileContent += listItemSign + categoryName;

    app.vault.modify(categoriesFile, categoriesFileContent);
  }
};

/**
 * Загрузка и сборка списка категорий
 * @returns array
 */
const loadCategories = async () => {
  if (categoriesNoteName === "") {
    return [];
  }

  const categoriesFile = app.vault.getAbstractFileByPath(categoriesNoteName);

  if (categoriesFile !== null) {
    const categoriesFileContent = await app.vault.read(categoriesFile);
    const categoriesList = categoriesFileContent
      .split("\n")
      .filter((s) => s.startsWith(listItemSign))
      .map((s) => s.slice(2));

    categoriesList.push(noCategoriesLabel);
    categoriesList.push(addCategoryLabel);
    categoriesList.push(cancelLabel);

    return categoriesList;
  }

  return [];
};

/**
 * Вызов меню для выбора категории
 * @returns string
 */
const getCategoryFromMenu = async () => {
  const categoriesList = await loadCategories();

  if (!categoriesList.length) {
    return "";
  }

  const quickAddApi = app.plugins.plugins["quickadd"].api;

  const pickedCategory = await quickAddApi.suggester(
    categoriesList,
    categoriesList
  );

  // Нажали "Добавить категорию"
  if (pickedCategory === addCategoryLabel) {
    const newCategoryName = await quickAddApi.inputPrompt(
      "Введите название для новой категории"
    );

    // и далее нажали "Отмена"
    if (newCategoryName === undefined) {
      return getCategoryFromMenu();
    } else if (newCategoryName !== "") {
      await createNewCategory(newCategoryName);
      return newCategoryName;
    }
  }

  if (pickedCategory === cancelLabel || pickedCategory === undefined) {
    return;
  }

  return pickedCategory;
};
