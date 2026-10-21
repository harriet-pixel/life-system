// All interactions are a temporary visual demonstration. Nothing is persisted.
const taskInputs = [...document.querySelectorAll('[data-task]')];
const taskCount = document.querySelector('#task-count');

function updateTaskCount() {
  const completed = taskInputs.filter((input) => input.checked).length;
  taskCount.textContent = `${completed} / ${taskInputs.length} 完成`;
}

taskInputs.forEach((input) => input.addEventListener('change', updateTaskCount));
document.querySelectorAll('[data-habit]').forEach((input) => {
  const update = () => {
    input.nextElementSibling.textContent = input.checked ? '已打卡' : '未打卡';
  };
  input.addEventListener('change', update);
  update();
});
updateTaskCount();
