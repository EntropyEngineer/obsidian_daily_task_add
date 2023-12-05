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
 */
module.exports = async () => {
  // Настраиваемые параметры
  const headingText = "## Задачи"; // Текст, после которого вставится задача
  const isOpenNote = false; // Открывать файл заметки при вставке задачи

  const tasksApi = app.plugins.plugins["obsidian-tasks-plugin"].apiV1;
  const taskLine = await tasksApi.createTaskLineModal();

  // Если не заполнили задачу, то выходим
  if (!taskLine) {
    return;
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
