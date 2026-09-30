var __typeError = (msg) => {
  throw TypeError(msg);
};
var __accessCheck = (obj, member, msg) => member.has(obj) || __typeError("Cannot " + msg);
var __privateGet = (obj, member, getter) => (__accessCheck(obj, member, "read from private field"), getter ? getter.call(obj) : member.get(obj));
var __privateAdd = (obj, member, value) => member.has(obj) ? __typeError("Cannot add the same private member more than once") : member instanceof WeakSet ? member.add(obj) : member.set(obj, value);
var __privateSet = (obj, member, value, setter) => (__accessCheck(obj, member, "write to private field"), setter ? setter.call(obj, value) : member.set(obj, value), value);
var __privateMethod = (obj, member, method) => (__accessCheck(obj, member, "access private method"), method);

// ../../packages/icons/src/icons.ts
var ROUTINE_ICONS = [
  {
    name: "sun",
    title: "Morning / wake up",
    viewBox: "0 0 256 256",
    path: "M120,40V16a8,8,0,0,1,16,0V40a8,8,0,0,1-16,0Zm72,88a64,64,0,1,1-64-64A64.07,64.07,0,0,1,192,128Zm-16,0a48,48,0,1,0-48,48A48.05,48.05,0,0,0,176,128ZM58.34,69.66A8,8,0,0,0,69.66,58.34l-16-16A8,8,0,0,0,42.34,53.66Zm0,116.68-16,16a8,8,0,0,0,11.32,11.32l16-16a8,8,0,0,0-11.32-11.32ZM192,72a8,8,0,0,0,5.66-2.34l16-16a8,8,0,0,0-11.32-11.32l-16,16A8,8,0,0,0,192,72Zm5.66,114.34a8,8,0,0,0-11.32,11.32l16,16a8,8,0,0,0,11.32-11.32ZM48,128a8,8,0,0,0-8-8H16a8,8,0,0,0,0,16H40A8,8,0,0,0,48,128Zm80,80a8,8,0,0,0-8,8v24a8,8,0,0,0,16,0V216A8,8,0,0,0,128,208Zm112-88H216a8,8,0,0,0,0,16h24a8,8,0,0,0,0-16Z"
  },
  {
    name: "moon-stars",
    title: "Evening / bedtime",
    viewBox: "0 0 256 256",
    path: "M240,96a8,8,0,0,1-8,8H216v16a8,8,0,0,1-16,0V104H184a8,8,0,0,1,0-16h16V72a8,8,0,0,1,16,0V88h16A8,8,0,0,1,240,96ZM144,56h8v8a8,8,0,0,0,16,0V56h8a8,8,0,0,0,0-16h-8V32a8,8,0,0,0-16,0v8h-8a8,8,0,0,0,0,16Zm72.77,97a8,8,0,0,1,1.43,8A96,96,0,1,1,95.07,37.8a8,8,0,0,1,10.6,9.06A88.07,88.07,0,0,0,209.14,150.33,8,8,0,0,1,216.77,153Zm-19.39,14.88c-1.79.09-3.59.14-5.38.14A104.11,104.11,0,0,1,88,64c0-1.79,0-3.59.14-5.38A80,80,0,1,0,197.38,167.86Z"
  },
  {
    name: "alarm",
    title: "Wake-up alarm",
    viewBox: "0 0 256 256",
    path: "M128,40a96,96,0,1,0,96,96A96.11,96.11,0,0,0,128,40Zm0,176a80,80,0,1,1,80-80A80.09,80.09,0,0,1,128,216ZM61.66,37.66l-32,32A8,8,0,0,1,18.34,58.34l32-32A8,8,0,0,1,61.66,37.66Zm176,32a8,8,0,0,1-11.32,0l-32-32a8,8,0,0,1,11.32-11.32l32,32A8,8,0,0,1,237.66,69.66ZM184,128a8,8,0,0,1,0,16H128a8,8,0,0,1-8-8V80a8,8,0,0,1,16,0v48Z"
  },
  {
    name: "tooth",
    title: "Brush teeth",
    viewBox: "0 0 256 256",
    path: "M171,71.42,149.54,80,171,88.57A8,8,0,1,1,165,103.42L128,88.61,91,103.42A8,8,0,1,1,85,88.57L106.46,80,85,71.42A8,8,0,1,1,91,56.57l37,14.81,37-14.81A8,8,0,1,1,171,71.42Zm53,8.33c0,42.72-8,75.4-14.69,95.28-8.73,25.8-20.63,45.49-32.65,54a15.69,15.69,0,0,1-15.95,1.41,16.09,16.09,0,0,1-9.18-13.36C150.68,205.58,146.48,168,128,168s-22.68,37.59-23.53,49.11a16.09,16.09,0,0,1-16,14.9,15.67,15.67,0,0,1-9.13-2.95c-12-8.53-23.92-28.22-32.65-54C40,155.15,32,122.47,32,79.75A56,56,0,0,1,88,24h80A56,56,0,0,1,224,79.75Zm-16,0A40,40,0,0,0,168,40H88A40,40,0,0,0,48,79.76c0,40.55,7.51,71.4,13.85,90.14,11.05,32.66,23,43.37,26.61,46C91.57,174.67,105.59,152,128,152s36.45,22.71,39.49,63.94h0c3.6-2.59,15.57-13.26,26.66-46C200.49,151.16,208,120.31,208,79.76Z"
  },
  {
    name: "shower",
    title: "Shower",
    viewBox: "0 0 256 256",
    path: "M64,236a12,12,0,1,1-12-12A12,12,0,0,1,64,236Zm20-44a12,12,0,1,0,12,12A12,12,0,0,0,84,192Zm-64,0a12,12,0,1,0,12,12A12,12,0,0,0,20,192Zm32-32a12,12,0,1,0,12,12A12,12,0,0,0,52,160ZM256,40a8,8,0,0,1-8,8H219.31L191.46,75.86,169.8,202.65a16,16,0,0,1-27.09,8.66l-98-98a16,16,0,0,1,8.69-27.1L180.14,64.54l30.2-30.2A8,8,0,0,1,216,32h32A8,8,0,0,1,256,40ZM174.21,81.79,56,102l98,98Z"
  },
  {
    name: "hand-soap",
    title: "Wash hands",
    viewBox: "0 0 256 256",
    path: "M184,96.8V88a32,32,0,0,0-32-32H136V32h32a8,8,0,0,1,8,8,8,8,0,0,0,16,0,24,24,0,0,0-24-24H104a8,8,0,0,0,0,16h16V56H104A32,32,0,0,0,72,88v8.8A40.07,40.07,0,0,0,40,136v80a16,16,0,0,0,16,16H200a16,16,0,0,0,16-16V136A40.07,40.07,0,0,0,184,96.8ZM104,72h48a16,16,0,0,1,16,16v8H88V88A16,16,0,0,1,104,72Zm96,144H56V136a24,24,0,0,1,24-24h96a24,24,0,0,1,24,24v80Z"
  },
  {
    name: "t-shirt",
    title: "Get dressed",
    viewBox: "0 0 256 256",
    path: "M247.59,61.22,195.83,33A8,8,0,0,0,192,32H160a8,8,0,0,0-8,8,24,24,0,0,1-48,0,8,8,0,0,0-8-8H64a8,8,0,0,0-3.84,1L8.41,61.22A15.76,15.76,0,0,0,1.82,82.48l19.27,36.81A16.37,16.37,0,0,0,35.67,128H56v80a16,16,0,0,0,16,16H184a16,16,0,0,0,16-16V128h20.34a16.37,16.37,0,0,0,14.58-8.71l19.27-36.81A15.76,15.76,0,0,0,247.59,61.22ZM35.67,112a.62.62,0,0,1-.41-.13L16.09,75.26,56,53.48V112ZM184,208H72V48h16.8a40,40,0,0,0,78.38,0H184Zm36.75-96.14a.55.55,0,0,1-.41.14H200V53.48l39.92,21.78Z"
  },
  {
    name: "pill",
    title: "Take medication",
    viewBox: "0 0 256 256",
    path: "M216.42,39.6a53.26,53.26,0,0,0-75.32,0L39.6,141.09a53.26,53.26,0,0,0,75.32,75.31h0L216.43,114.91A53.31,53.31,0,0,0,216.42,39.6ZM103.61,205.09h0a37.26,37.26,0,0,1-52.7-52.69L96,107.31,148.7,160ZM205.11,103.6,160,148.69,107.32,96l45.1-45.09a37.26,37.26,0,0,1,52.69,52.69ZM189.68,82.34a8,8,0,0,1,0,11.32l-24,24a8,8,0,1,1-11.31-11.32l24-24A8,8,0,0,1,189.68,82.34Z"
  },
  {
    name: "fork-knife",
    title: "Eat meal",
    viewBox: "0 0 256 256",
    path: "M72,88V40a8,8,0,0,1,16,0V88a8,8,0,0,1-16,0ZM216,40V224a8,8,0,0,1-16,0V176H152a8,8,0,0,1-8-8,268.75,268.75,0,0,1,7.22-56.88c9.78-40.49,28.32-67.63,53.63-78.47A8,8,0,0,1,216,40ZM200,53.9c-32.17,24.57-38.47,84.42-39.7,106.1H200ZM119.89,38.69a8,8,0,1,0-15.78,2.63L112,88.63a32,32,0,0,1-64,0l7.88-47.31a8,8,0,1,0-15.78-2.63l-8,48A8.17,8.17,0,0,0,32,88a48.07,48.07,0,0,0,40,47.32V224a8,8,0,0,0,16,0V135.32A48.07,48.07,0,0,0,128,88a8.17,8.17,0,0,0-.11-1.31Z"
  },
  {
    name: "bowl-steam",
    title: "Meal",
    viewBox: "0 0 256 256",
    path: "M224,112H32a8,8,0,0,0-8,8,104.35,104.35,0,0,0,56,92.28V216a16,16,0,0,0,16,16h64a16,16,0,0,0,16-16v-3.72A104.35,104.35,0,0,0,232,120,8,8,0,0,0,224,112Zm-59.34,88a8,8,0,0,0-4.66,7.27V216H96v-8.71A8,8,0,0,0,91.34,200a88.29,88.29,0,0,1-51-72H215.63A88.29,88.29,0,0,1,164.66,200ZM81.77,55c5.35-6.66,6.67-11.16,6.12-13.14-.42-1.49-2.41-2.26-2.43-2.26A8,8,0,0,1,88,24a8.11,8.11,0,0,1,2.38.36c1,.31,9.91,3.33,12.79,12.76,2.46,8.07-.55,17.45-8.94,27.89-5.35,6.66-6.67,11.16-6.12,13.14.42,1.49,2.37,2.24,2.39,2.25A8,8,0,0,1,88,96a8.11,8.11,0,0,1-2.38-.36c-1-.31-9.91-3.33-12.79-12.76C70.37,74.81,73.38,65.43,81.77,55Zm40,0c5.35-6.66,6.67-11.16,6.12-13.14-.42-1.49-2.41-2.26-2.43-2.26A8,8,0,0,1,128,24a8.11,8.11,0,0,1,2.38.36c1,.31,9.91,3.33,12.79,12.76,2.46,8.07-.55,17.45-8.94,27.89-5.35,6.66-6.67,11.16-6.12,13.14.42,1.49,2.37,2.24,2.39,2.25A8,8,0,0,1,128,96a8.11,8.11,0,0,1-2.38-.36c-1-.31-9.91-3.33-12.79-12.76C110.37,74.81,113.38,65.43,121.77,55Zm40,0c5.35-6.66,6.67-11.16,6.12-13.14-.42-1.49-2.41-2.26-2.43-2.26A8,8,0,0,1,168,24a8.11,8.11,0,0,1,2.38.36c1,.31,9.91,3.33,12.79,12.76,2.46,8.07-.55,17.45-8.94,27.89-5.35,6.66-6.67,11.16-6.12,13.14.42,1.49,2.37,2.24,2.39,2.25A8,8,0,0,1,168,96a8.11,8.11,0,0,1-2.38-.36c-1-.31-9.91-3.33-12.79-12.76C150.37,74.81,153.38,65.43,161.77,55Z"
  },
  {
    name: "cooking-pot",
    title: "Cooking",
    viewBox: "0 0 256 256",
    path: "M88,48V16a8,8,0,0,1,16,0V48a8,8,0,0,1-16,0Zm40,8a8,8,0,0,0,8-8V16a8,8,0,0,0-16,0V48A8,8,0,0,0,128,56Zm32,0a8,8,0,0,0,8-8V16a8,8,0,0,0-16,0V48A8,8,0,0,0,160,56Zm92.8,46.4L224,124v60a32,32,0,0,1-32,32H64a32,32,0,0,1-32-32V124L3.2,102.4a8,8,0,0,1,9.6-12.8L32,104V80a8,8,0,0,1,8-8H216a8,8,0,0,1,8,8v24l19.2-14.4a8,8,0,0,1,9.6,12.8ZM208,88H48v96a16,16,0,0,0,16,16H192a16,16,0,0,0,16-16Z"
  },
  {
    name: "coffee",
    title: "Coffee / drink break",
    viewBox: "0 0 256 256",
    path: "M80,56V24a8,8,0,0,1,16,0V56a8,8,0,0,1-16,0Zm40,8a8,8,0,0,0,8-8V24a8,8,0,0,0-16,0V56A8,8,0,0,0,120,64Zm32,0a8,8,0,0,0,8-8V24a8,8,0,0,0-16,0V56A8,8,0,0,0,152,64Zm96,56v8a40,40,0,0,1-37.51,39.91,96.59,96.59,0,0,1-27,40.09H208a8,8,0,0,1,0,16H32a8,8,0,0,1,0-16H56.54A96.3,96.3,0,0,1,24,136V88a8,8,0,0,1,8-8H208A40,40,0,0,1,248,120ZM200,96H40v40a80.27,80.27,0,0,0,45.12,72h69.76A80.27,80.27,0,0,0,200,136Zm32,24a24,24,0,0,0-16-22.62V136a95.78,95.78,0,0,1-1.2,15A24,24,0,0,0,232,128Z"
  },
  {
    name: "drop",
    title: "Drink water",
    viewBox: "0 0 256 256",
    path: "M174,47.75a254.19,254.19,0,0,0-41.45-38.3,8,8,0,0,0-9.18,0A254.19,254.19,0,0,0,82,47.75C54.51,79.32,40,112.6,40,144a88,88,0,0,0,176,0C216,112.6,201.49,79.32,174,47.75ZM128,216a72.08,72.08,0,0,1-72-72c0-57.23,55.47-105,72-118,16.53,13,72,60.75,72,118A72.08,72.08,0,0,1,128,216Zm55.89-62.66a57.6,57.6,0,0,1-46.56,46.55A8.75,8.75,0,0,1,136,200a8,8,0,0,1-1.32-15.89c16.57-2.79,30.63-16.85,33.44-33.45a8,8,0,0,1,15.78,2.68Z"
  },
  {
    name: "shopping-cart",
    title: "Grocery shopping",
    viewBox: "0 0 256 256",
    path: "M230.14,58.87A8,8,0,0,0,224,56H62.68L56.6,22.57A8,8,0,0,0,48.73,16H24a8,8,0,0,0,0,16h18L67.56,172.29a24,24,0,0,0,5.33,11.27,28,28,0,1,0,44.4,8.44h45.42A27.75,27.75,0,0,0,160,204a28,28,0,1,0,28-28H91.17a8,8,0,0,1-7.87-6.57L80.13,152h116a24,24,0,0,0,23.61-19.71l12.16-66.86A8,8,0,0,0,230.14,58.87ZM104,204a12,12,0,1,1-12-12A12,12,0,0,1,104,204Zm96,0a12,12,0,1,1-12-12A12,12,0,0,1,200,204Zm4-74.57A8,8,0,0,1,196.1,136H77.22L65.59,72H214.41Z"
  },
  {
    name: "basket",
    title: "Shopping / groceries",
    viewBox: "0 0 256 256",
    path: "M136,120v56a8,8,0,0,1-16,0V120a8,8,0,0,1,16,0Zm36.84-.8-5.6,56A8,8,0,0,0,174.4,184a7.32,7.32,0,0,0,.81,0,8,8,0,0,0,7.95-7.2l5.6-56a8,8,0,0,0-15.92-1.6Zm-89.68,0a8,8,0,0,0-15.92,1.6l5.6,56a8,8,0,0,0,8,7.2,7.32,7.32,0,0,0,.81,0,8,8,0,0,0,7.16-8.76ZM239.93,89.06,224.86,202.12A16.06,16.06,0,0,1,209,216H47a16.06,16.06,0,0,1-15.86-13.88L16.07,89.06A8,8,0,0,1,24,80H68.37L122,18.73a8,8,0,0,1,12,0L187.63,80H232a8,8,0,0,1,7.93,9.06ZM89.63,80h76.74L128,36.15ZM222.86,96H33.14L47,200H209Z"
  },
  {
    name: "washing-machine",
    title: "Wash clothing / laundry",
    viewBox: "0 0 256 256",
    path: "M208,32H48A16,16,0,0,0,32,48V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V48A16,16,0,0,0,208,32Zm0,176H48V48H208V208ZM128,64a64,64,0,1,0,64,64A64.07,64.07,0,0,0,128,64Zm0,112a48,48,0,1,1,48-48A48.05,48.05,0,0,1,128,176ZM200,68a12,12,0,1,1-12-12A12,12,0,0,1,200,68Zm-74.34,49.66-16,16a8,8,0,0,1-11.32-11.32l16-16a8,8,0,0,1,11.32,11.32Zm32-3.32a8,8,0,0,1,0,11.32l-32,32a8,8,0,0,1-11.32-11.32l32-32A8,8,0,0,1,157.66,114.34Z"
  },
  {
    // Phosphor spells this coat-hanger, not hanger.
    name: "coat-hanger",
    title: "Hang / put away clothing",
    viewBox: "0 0 256 256",
    path: "M241.57,171.2,141.33,96l23.46-17.6A8,8,0,0,0,168,72a40,40,0,1,0-80,0,8,8,0,0,0,16,0,24,24,0,0,1,47.69-3.78L123.34,89.49l-.28.21L14.43,171.2A16,16,0,0,0,24,200H232a16,16,0,0,0,9.6-28.8ZM232,184H24l104-78,104,78Z"
  },
  {
    name: "broom",
    title: "Cleaning",
    viewBox: "0 0 256 256",
    path: "M235.5,216.81c-22.56-11-35.5-34.58-35.5-64.8V134.73a15.94,15.94,0,0,0-10.09-14.87L165,110a8,8,0,0,1-4.48-10.34l21.32-53a28,28,0,0,0-16.1-37,28.14,28.14,0,0,0-35.82,16,.61.61,0,0,0,0,.12L108.9,79a8,8,0,0,1-10.37,4.49L73.11,73.14A15.89,15.89,0,0,0,55.74,76.8C34.68,98.45,24,123.75,24,152a111.45,111.45,0,0,0,31.18,77.53A8,8,0,0,0,61,232H232a8,8,0,0,0,3.5-15.19ZM67.14,88l25.41,10.3a24,24,0,0,0,31.23-13.45l21-53c2.56-6.11,9.47-9.27,15.43-7a12,12,0,0,1,6.88,15.92L145.69,93.76a24,24,0,0,0,13.43,31.14L184,134.73V152c0,.33,0,.66,0,1L55.77,101.71A108.84,108.84,0,0,1,67.14,88Zm48,128a87.53,87.53,0,0,1-24.34-42,8,8,0,0,0-15.49,4,105.16,105.16,0,0,0,18.36,38H64.44A95.54,95.54,0,0,1,40,152a85.9,85.9,0,0,1,7.73-36.29l137.8,55.12c3,18,10.56,33.48,21.89,45.16Z"
  },
  {
    // Phosphor has no vacuum icon in any weight; wind stands in for it.
    name: "wind",
    title: "Vacuuming",
    viewBox: "0 0 256 256",
    path: "M184,184a32,32,0,0,1-32,32c-13.7,0-26.95-8.93-31.5-21.22a8,8,0,0,1,15-5.56C137.74,195.27,145,200,152,200a16,16,0,0,0,0-32H40a8,8,0,0,1,0-16H152A32,32,0,0,1,184,184Zm-64-80a32,32,0,0,0,0-64c-13.7,0-26.95,8.93-31.5,21.22a8,8,0,0,0,15,5.56C105.74,60.73,113,56,120,56a16,16,0,0,1,0,32H24a8,8,0,0,0,0,16Zm88-32c-13.7,0-26.95,8.93-31.5,21.22a8,8,0,0,0,15,5.56C193.74,92.73,201,88,208,88a16,16,0,0,1,0,32H32a8,8,0,0,0,0,16H208a32,32,0,0,0,0-64Z"
  },
  {
    name: "spray-bottle",
    title: "Clean surfaces",
    viewBox: "0 0 256 256",
    path: "M200,80a8,8,0,0,0,8-8,56.06,56.06,0,0,0-56-56H80A16,16,0,0,0,64,32V80a24,24,0,0,1-24,24,8,8,0,0,0,0,16A40,40,0,0,0,80,80h32v24.62a23.87,23.87,0,0,1-9,18.74L87,136.15a39.79,39.79,0,0,0-15,31.23V224a16,16,0,0,0,16,16H192a16,16,0,0,0,16-16V211.47A270.88,270.88,0,0,0,174,80ZM80,32h72a40.08,40.08,0,0,1,39.2,32H80ZM192,211.47V224H88V167.38a23.87,23.87,0,0,1,9-18.74l16-12.79a39.79,39.79,0,0,0,15-31.23V80h27.52A254.86,254.86,0,0,1,192,211.47Z"
  },
  {
    name: "trash",
    title: "Take out trash",
    viewBox: "0 0 256 256",
    path: "M216,48H176V40a24,24,0,0,0-24-24H104A24,24,0,0,0,80,40v8H40a8,8,0,0,0,0,16h8V208a16,16,0,0,0,16,16H192a16,16,0,0,0,16-16V64h8a8,8,0,0,0,0-16ZM96,40a8,8,0,0,1,8-8h48a8,8,0,0,1,8,8v8H96Zm96,168H64V64H192ZM112,104v64a8,8,0,0,1-16,0V104a8,8,0,0,1,16,0Zm48,0v64a8,8,0,0,1-16,0V104a8,8,0,0,1,16,0Z"
  },
  {
    // Phosphor spells this recycle, not recycling.
    name: "recycle",
    title: "Recycling",
    viewBox: "0 0 256 256",
    path: "M96,208a8,8,0,0,1-8,8H40a24,24,0,0,1-20.77-36l34.29-59.25L39.47,124.5A8,8,0,1,1,35.33,109l32.77-8.77a8,8,0,0,1,9.8,5.66l8.79,32.77A8,8,0,0,1,81,148.5a8.37,8.37,0,0,1-2.08.27,8,8,0,0,1-7.72-5.93l-3.8-14.15L33.11,188A8,8,0,0,0,40,200H88A8,8,0,0,1,96,208Zm140.73-28-23.14-40a8,8,0,0,0-13.84,8l23.14,40A8,8,0,0,1,216,200H147.31l10.34-10.34a8,8,0,0,0-11.31-11.32l-24,24a8,8,0,0,0,0,11.32l24,24a8,8,0,0,0,11.31-11.32L147.31,216H216a24,24,0,0,0,20.77-36ZM128,32a7.85,7.85,0,0,1,6.92,4l34.29,59.25-14.08-3.78A8,8,0,0,0,151,106.92l32.78,8.79a8.23,8.23,0,0,0,2.07.27,8,8,0,0,0,7.72-5.93l8.79-32.79a8,8,0,1,0-15.45-4.14l-3.8,14.17L148.77,28a24,24,0,0,0-41.54,0L84.07,68a8,8,0,0,0,13.85,8l23.16-40A7.85,7.85,0,0,1,128,32Z"
  },
  {
    name: "bed",
    title: "Sleep / rest",
    viewBox: "0 0 256 256",
    path: "M216,72H32V48a8,8,0,0,0-16,0V208a8,8,0,0,0,16,0V176H240v32a8,8,0,0,0,16,0V112A40,40,0,0,0,216,72ZM32,88h72v72H32Zm88,72V88h96a24,24,0,0,1,24,24v48Z"
  },
  {
    name: "chair",
    title: "Rest break",
    viewBox: "0 0 256 256",
    path: "M208,136H176V104h16a16,16,0,0,0,16-16V40a16,16,0,0,0-16-16H64A16,16,0,0,0,48,40V88a16,16,0,0,0,16,16H80v32H48a16,16,0,0,0-16,16v16a16,16,0,0,0,16,16h8v40a8,8,0,0,0,16,0V184H184v40a8,8,0,0,0,16,0V184h8a16,16,0,0,0,16-16V152A16,16,0,0,0,208,136ZM64,40H192V88H64Zm32,64h64v32H96Zm112,64H48V152H208v16Z"
  },
  {
    name: "person-simple-walk",
    title: "Walking",
    viewBox: "0 0 256 256",
    path: "M152,80a32,32,0,1,0-32-32A32,32,0,0,0,152,80Zm0-48a16,16,0,1,1-16,16A16,16,0,0,1,152,32Zm64,112a8,8,0,0,1-8,8c-35.31,0-52.95-17.81-67.12-32.12-2.74-2.77-5.36-5.4-8-7.84l-13.43,30.88,37.2,26.57A8,8,0,0,1,160,176v56a8,8,0,0,1-16,0V180.12l-31.07-22.2L79.34,235.19A8,8,0,0,1,72,240a7.84,7.84,0,0,1-3.19-.67,8,8,0,0,1-4.15-10.52l54.08-124.37c-9.31-1.65-20.92,1.2-34.7,8.58a163.88,163.88,0,0,0-30.57,21.77,8,8,0,0,1-10.95-11.66c2.5-2.35,61.69-57.23,98.72-25.08,3.83,3.32,7.48,7,11,10.57C166.19,122.7,179.36,136,208,136A8,8,0,0,1,216,144Z"
  },
  {
    name: "car",
    title: "Car trip",
    viewBox: "0 0 256 256",
    path: "M240,104H229.2L201.42,41.5A16,16,0,0,0,186.8,32H69.2a16,16,0,0,0-14.62,9.5L26.8,104H16a8,8,0,0,0,0,16h8v80a16,16,0,0,0,16,16H64a16,16,0,0,0,16-16V184h96v16a16,16,0,0,0,16,16h24a16,16,0,0,0,16-16V120h8a8,8,0,0,0,0-16ZM69.2,48H186.8l24.89,56H44.31ZM64,200H40V184H64Zm128,0V184h24v16Zm24-32H40V120H216ZM56,144a8,8,0,0,1,8-8H80a8,8,0,0,1,0,16H64A8,8,0,0,1,56,144Zm112,0a8,8,0,0,1,8-8h16a8,8,0,0,1,0,16H176A8,8,0,0,1,168,144Z"
  },
  {
    name: "bus",
    title: "Bus trip",
    viewBox: "0 0 256 256",
    path: "M184,32H72A32,32,0,0,0,40,64V208a16,16,0,0,0,16,16H80a16,16,0,0,0,16-16V192h64v16a16,16,0,0,0,16,16h24a16,16,0,0,0,16-16V64A32,32,0,0,0,184,32ZM56,176V120H200v56Zm0-96H200v24H56ZM72,48H184a16,16,0,0,1,16,16H56A16,16,0,0,1,72,48Zm8,160H56V192H80Zm96,0V192h24v16Zm-72-60a12,12,0,1,1-12-12A12,12,0,0,1,104,148Zm72,0a12,12,0,1,1-12-12A12,12,0,0,1,176,148Zm72-68v24a8,8,0,0,1-16,0V80a8,8,0,0,1,16,0ZM24,80v24a8,8,0,0,1-16,0V80a8,8,0,0,1,16,0Z"
  },
  {
    name: "map-pin",
    title: "Go somewhere / destination",
    viewBox: "0 0 256 256",
    path: "M128,64a40,40,0,1,0,40,40A40,40,0,0,0,128,64Zm0,64a24,24,0,1,1,24-24A24,24,0,0,1,128,128Zm0-112a88.1,88.1,0,0,0-88,88c0,31.4,14.51,64.68,42,96.25a254.19,254.19,0,0,0,41.45,38.3,8,8,0,0,0,9.18,0A254.19,254.19,0,0,0,174,200.25c27.45-31.57,42-64.85,42-96.25A88.1,88.1,0,0,0,128,16Zm0,206c-16.53-13-72-60.75-72-118a72,72,0,0,1,144,0C200,161.23,144.53,209,128,222Z"
  },
  {
    name: "phone-call",
    title: "Call someone",
    viewBox: "0 0 256 256",
    path: "M144.27,45.93a8,8,0,0,1,9.8-5.66,86.22,86.22,0,0,1,61.66,61.66,8,8,0,0,1-5.66,9.8A8.23,8.23,0,0,1,208,112a8,8,0,0,1-7.73-5.94,70.35,70.35,0,0,0-50.33-50.33A8,8,0,0,1,144.27,45.93Zm-2.33,41.8c13.79,3.68,22.65,12.54,26.33,26.33A8,8,0,0,0,176,120a8.23,8.23,0,0,0,2.07-.27,8,8,0,0,0,5.66-9.8c-5.12-19.16-18.5-32.54-37.66-37.66a8,8,0,1,0-4.13,15.46Zm81.94,95.35A56.26,56.26,0,0,1,168,232C88.6,232,24,167.4,24,88A56.26,56.26,0,0,1,72.92,32.12a16,16,0,0,1,16.62,9.52l21.12,47.15,0,.12A16,16,0,0,1,109.39,104c-.18.27-.37.52-.57.77L88,129.45c7.49,15.22,23.41,31,38.83,38.51l24.34-20.71a8.12,8.12,0,0,1,.75-.56,16,16,0,0,1,15.17-1.4l.13.06,47.11,21.11A16,16,0,0,1,223.88,183.08Zm-15.88-2s-.07,0-.11,0h0l-47-21.05-24.35,20.71a8.44,8.44,0,0,1-.74.56,16,16,0,0,1-15.75,1.14c-18.73-9.05-37.4-27.58-46.46-46.11a16,16,0,0,1,1-15.7,6.13,6.13,0,0,1,.57-.77L96,95.15l-21-47a.61.61,0,0,1,0-.12A40.2,40.2,0,0,0,40,88,128.14,128.14,0,0,0,168,216,40.21,40.21,0,0,0,208,181.07Z"
  },
  {
    name: "chat-circle-text",
    title: "Send message",
    viewBox: "0 0 256 256",
    path: "M168,112a8,8,0,0,1-8,8H96a8,8,0,0,1,0-16h64A8,8,0,0,1,168,112Zm-8,24H96a8,8,0,0,0,0,16h64a8,8,0,0,0,0-16Zm72-8A104,104,0,0,1,79.12,219.82L45.07,231.17a16,16,0,0,1-20.24-20.24l11.35-34.05A104,104,0,1,1,232,128Zm-16,0A88,88,0,1,0,51.81,172.06a8,8,0,0,1,.66,6.54L40,216,77.4,203.53a7.85,7.85,0,0,1,2.53-.42,8,8,0,0,1,4,1.08A88,88,0,0,0,216,128Z"
  },
  {
    name: "video-conference",
    title: "Video call",
    viewBox: "0 0 256 256",
    path: "M216,40H40A16,16,0,0,0,24,56V200a16,16,0,0,0,16,16H216a16,16,0,0,0,16-16V56A16,16,0,0,0,216,40Zm0,80H168V56h48ZM40,56H152V200H40ZM216,200H168V136h48v64ZM180,88a12,12,0,1,1,12,12A12,12,0,0,1,180,88Zm24,80a12,12,0,1,1-12-12A12,12,0,0,1,204,168Zm-68.25-2a39.76,39.76,0,0,0-17.19-23.34,32,32,0,1,0-45.12,0A39.84,39.84,0,0,0,56.25,166a8,8,0,0,0,15.5,4c2.64-10.25,13.06-18,24.25-18s21.62,7.73,24.25,18a8,8,0,1,0,15.5-4ZM80,120a16,16,0,1,1,16,16A16,16,0,0,1,80,120Z"
  },
  {
    name: "users-three",
    title: "Meeting / social activity",
    viewBox: "0 0 256 256",
    path: "M244.8,150.4a8,8,0,0,1-11.2-1.6A51.6,51.6,0,0,0,192,128a8,8,0,0,1-7.37-4.89,8,8,0,0,1,0-6.22A8,8,0,0,1,192,112a24,24,0,1,0-23.24-30,8,8,0,1,1-15.5-4A40,40,0,1,1,219,117.51a67.94,67.94,0,0,1,27.43,21.68A8,8,0,0,1,244.8,150.4ZM190.92,212a8,8,0,1,1-13.84,8,57,57,0,0,0-98.16,0,8,8,0,1,1-13.84-8,72.06,72.06,0,0,1,33.74-29.92,48,48,0,1,1,58.36,0A72.06,72.06,0,0,1,190.92,212ZM128,176a32,32,0,1,0-32-32A32,32,0,0,0,128,176ZM72,120a8,8,0,0,0-8-8A24,24,0,1,1,87.24,82a8,8,0,1,0,15.5-4A40,40,0,1,0,37,117.51,67.94,67.94,0,0,0,9.6,139.19a8,8,0,1,0,12.8,9.61A51.6,51.6,0,0,1,64,128,8,8,0,0,0,72,120Z"
  },
  {
    name: "game-controller",
    title: "PC / console gaming time",
    viewBox: "0 0 256 256",
    path: "M176,112H152a8,8,0,0,1,0-16h24a8,8,0,0,1,0,16ZM104,96H96V88a8,8,0,0,0-16,0v8H72a8,8,0,0,0,0,16h8v8a8,8,0,0,0,16,0v-8h8a8,8,0,0,0,0-16ZM241.48,200.65a36,36,0,0,1-54.94,4.81c-.12-.12-.24-.24-.35-.37L146.48,160h-37L69.81,205.09l-.35.37A36.08,36.08,0,0,1,44,216,36,36,0,0,1,8.56,173.75a.68.68,0,0,1,0-.14L24.93,89.52A59.88,59.88,0,0,1,83.89,40H172a60.08,60.08,0,0,1,59,49.25c0,.06,0,.12,0,.18l16.37,84.17a.68.68,0,0,1,0,.14A35.74,35.74,0,0,1,241.48,200.65ZM172,144a44,44,0,0,0,0-88H83.89A43.9,43.9,0,0,0,40.68,92.37l0,.13L24.3,176.59A20,20,0,0,0,58,194.3l41.92-47.59a8,8,0,0,1,6-2.71Zm59.7,32.59-8.74-45A60,60,0,0,1,172,160h-4.2L198,194.31a20.09,20.09,0,0,0,17.46,5.39,20,20,0,0,0,16.23-23.11Z"
  },
  {
    name: "headphones",
    title: "Music / sensory break",
    viewBox: "0 0 256 256",
    path: "M201.89,54.66A103.43,103.43,0,0,0,128.79,24H128A104,104,0,0,0,24,128v56a24,24,0,0,0,24,24H64a24,24,0,0,0,24-24V144a24,24,0,0,0-24-24H40.36A88,88,0,0,1,128,40h.67a87.71,87.71,0,0,1,87,80H192a24,24,0,0,0-24,24v40a24,24,0,0,0,24,24h16a24,24,0,0,0,24-24V128A103.41,103.41,0,0,0,201.89,54.66ZM64,136a8,8,0,0,1,8,8v40a8,8,0,0,1-8,8H48a8,8,0,0,1-8-8V136Zm152,48a8,8,0,0,1-8,8H192a8,8,0,0,1-8-8V144a8,8,0,0,1,8-8h24Z"
  },
  {
    name: "television-simple",
    title: "TV time",
    viewBox: "0 0 256 256",
    path: "M216,64H147.31l34.35-34.34a8,8,0,1,0-11.32-11.32L128,60.69,85.66,18.34A8,8,0,0,0,74.34,29.66L108.69,64H40A16,16,0,0,0,24,80V200a16,16,0,0,0,16,16H216a16,16,0,0,0,16-16V80A16,16,0,0,0,216,64Zm0,136H40V80H216V200Z"
  },
  {
    name: "book-open",
    title: "Reading",
    viewBox: "0 0 256 256",
    path: "M232,48H160a40,40,0,0,0-32,16A40,40,0,0,0,96,48H24a8,8,0,0,0-8,8V200a8,8,0,0,0,8,8H96a24,24,0,0,1,24,24,8,8,0,0,0,16,0,24,24,0,0,1,24-24h72a8,8,0,0,0,8-8V56A8,8,0,0,0,232,48ZM96,192H32V64H96a24,24,0,0,1,24,24V200A39.81,39.81,0,0,0,96,192Zm128,0H160a39.81,39.81,0,0,0-24,8V88a24,24,0,0,1,24-24h64Z"
  },
  {
    name: "laptop",
    title: "Computer time / computer task",
    viewBox: "0 0 256 256",
    path: "M232,168h-8V72a24,24,0,0,0-24-24H56A24,24,0,0,0,32,72v96H24a8,8,0,0,0-8,8v16a24,24,0,0,0,24,24H216a24,24,0,0,0,24-24V176A8,8,0,0,0,232,168ZM48,72a8,8,0,0,1,8-8H200a8,8,0,0,1,8,8v96H48ZM224,192a8,8,0,0,1-8,8H40a8,8,0,0,1-8-8v-8H224ZM152,88a8,8,0,0,1-8,8H112a8,8,0,0,1,0-16h32A8,8,0,0,1,152,88Z"
  },
  {
    name: "briefcase",
    title: "Work",
    viewBox: "0 0 256 256",
    path: "M216,56H176V48a24,24,0,0,0-24-24H104A24,24,0,0,0,80,48v8H40A16,16,0,0,0,24,72V200a16,16,0,0,0,16,16H216a16,16,0,0,0,16-16V72A16,16,0,0,0,216,56ZM96,48a8,8,0,0,1,8-8h48a8,8,0,0,1,8,8v8H96ZM216,72v41.61A184,184,0,0,1,128,136a184.07,184.07,0,0,1-88-22.38V72Zm0,128H40V131.64A200.19,200.19,0,0,0,128,152a200.25,200.25,0,0,0,88-20.37V200ZM104,112a8,8,0,0,1,8-8h32a8,8,0,0,1,0,16H112A8,8,0,0,1,104,112Z"
  },
  {
    name: "calendar-blank",
    title: "Appointment",
    viewBox: "0 0 256 256",
    path: "M208,32H184V24a8,8,0,0,0-16,0v8H88V24a8,8,0,0,0-16,0v8H48A16,16,0,0,0,32,48V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V48A16,16,0,0,0,208,32ZM72,48v8a8,8,0,0,0,16,0V48h80v8a8,8,0,0,0,16,0V48h24V80H48V48ZM208,208H48V96H208V208Z"
  },
  {
    name: "calendar-check",
    title: "Confirmed appointment",
    viewBox: "0 0 256 256",
    path: "M208,32H184V24a8,8,0,0,0-16,0v8H88V24a8,8,0,0,0-16,0v8H48A16,16,0,0,0,32,48V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V48A16,16,0,0,0,208,32ZM72,48v8a8,8,0,0,0,16,0V48h80v8a8,8,0,0,0,16,0V48h24V80H48V48ZM208,208H48V96H208V208Zm-38.34-85.66a8,8,0,0,1,0,11.32l-48,48a8,8,0,0,1-11.32,0l-24-24a8,8,0,0,1,11.32-11.32L116,164.69l42.34-42.35A8,8,0,0,1,169.66,122.34Z"
  },
  {
    name: "stethoscope",
    title: "Doctor appointment",
    viewBox: "0 0 256 256",
    path: "M220,160a12,12,0,1,1-12-12A12,12,0,0,1,220,160Zm-4.55,39.29A48.08,48.08,0,0,1,168,240H144a48.05,48.05,0,0,1-48-48V151.49A64,64,0,0,1,40,88V40a8,8,0,0,1,8-8H72a8,8,0,0,1,0,16H56V88a48,48,0,0,0,48.64,48c26.11-.34,47.36-22.25,47.36-48.83V48H136a8,8,0,0,1,0-16h24a8,8,0,0,1,8,8V87.17c0,32.84-24.53,60.29-56,64.31V192a32,32,0,0,0,32,32h24a32.06,32.06,0,0,0,31.22-25,40,40,0,1,1,16.23.27ZM232,160a24,24,0,1,0-24,24A24,24,0,0,0,232,160Z"
  },
  {
    name: "hospital",
    title: "Hospital / medical appointment",
    viewBox: "0 0 256 256",
    path: "M248,208h-8V128a16,16,0,0,0-16-16H168V48a16,16,0,0,0-16-16H56A16,16,0,0,0,40,48V208H32a8,8,0,0,0,0,16H248a8,8,0,0,0,0-16Zm-24-80v80H168V128ZM56,48h96V208H136V160a8,8,0,0,0-8-8H80a8,8,0,0,0-8,8v48H56Zm64,160H88V168h32ZM72,96a8,8,0,0,1,8-8H96V72a8,8,0,0,1,16,0V88h16a8,8,0,0,1,0,16H112v16a8,8,0,0,1-16,0V104H80A8,8,0,0,1,72,96Z"
  },
  {
    name: "bell",
    title: "Reminder",
    viewBox: "0 0 256 256",
    path: "M221.8,175.94C216.25,166.38,208,139.33,208,104a80,80,0,1,0-160,0c0,35.34-8.26,62.38-13.81,71.94A16,16,0,0,0,48,200H88.81a40,40,0,0,0,78.38,0H208a16,16,0,0,0,13.8-24.06ZM128,216a24,24,0,0,1-22.62-16h45.24A24,24,0,0,1,128,216ZM48,184c7.7-13.24,16-43.92,16-80a64,64,0,1,1,128,0c0,36.05,8.28,66.73,16,80Z"
  },
  {
    name: "timer",
    title: "Timed task / focus time",
    viewBox: "0 0 256 256",
    path: "M128,40a96,96,0,1,0,96,96A96.11,96.11,0,0,0,128,40Zm0,176a80,80,0,1,1,80-80A80.09,80.09,0,0,1,128,216ZM173.66,90.34a8,8,0,0,1,0,11.32l-40,40a8,8,0,0,1-11.32-11.32l40-40A8,8,0,0,1,173.66,90.34ZM96,16a8,8,0,0,1,8-8h48a8,8,0,0,1,0,16H104A8,8,0,0,1,96,16Z"
  },
  {
    name: "list-checks",
    title: "Checklist / routine",
    viewBox: "0 0 256 256",
    path: "M224,128a8,8,0,0,1-8,8H128a8,8,0,0,1,0-16h88A8,8,0,0,1,224,128ZM128,72h88a8,8,0,0,0,0-16H128a8,8,0,0,0,0,16Zm88,112H128a8,8,0,0,0,0,16h88a8,8,0,0,0,0-16ZM82.34,42.34,56,68.69,45.66,58.34A8,8,0,0,0,34.34,69.66l16,16a8,8,0,0,0,11.32,0l32-32A8,8,0,0,0,82.34,42.34Zm0,64L56,132.69,45.66,122.34a8,8,0,0,0-11.32,11.32l16,16a8,8,0,0,0,11.32,0l32-32a8,8,0,0,0-11.32-11.32Zm0,64L56,196.69,45.66,186.34a8,8,0,0,0-11.32,11.32l16,16a8,8,0,0,0,11.32,0l32-32a8,8,0,0,0-11.32-11.32Z"
  },
  {
    name: "check-square",
    title: "Task",
    viewBox: "0 0 256 256",
    path: "M173.66,98.34a8,8,0,0,1,0,11.32l-56,56a8,8,0,0,1-11.32,0l-24-24a8,8,0,0,1,11.32-11.32L112,148.69l50.34-50.35A8,8,0,0,1,173.66,98.34ZM224,48V208a16,16,0,0,1-16,16H48a16,16,0,0,1-16-16V48A16,16,0,0,1,48,32H208A16,16,0,0,1,224,48ZM208,208V48H48V208H208Z"
  },
  {
    name: "check-circle",
    title: "Completed task",
    viewBox: "0 0 256 256",
    path: "M173.66,98.34a8,8,0,0,1,0,11.32l-56,56a8,8,0,0,1-11.32,0l-24-24a8,8,0,0,1,11.32-11.32L112,148.69l50.34-50.35A8,8,0,0,1,173.66,98.34ZM232,128A104,104,0,1,1,128,24,104.11,104.11,0,0,1,232,128Zm-16,0a88,88,0,1,0-88,88A88.1,88.1,0,0,0,216,128Z"
  },
  {
    name: "repeat",
    title: "Recurring routine",
    viewBox: "0 0 256 256",
    path: "M24,128A72.08,72.08,0,0,1,96,56H204.69L194.34,45.66a8,8,0,0,1,11.32-11.32l24,24a8,8,0,0,1,0,11.32l-24,24a8,8,0,0,1-11.32-11.32L204.69,72H96a56.06,56.06,0,0,0-56,56,8,8,0,0,1-16,0Zm200-8a8,8,0,0,0-8,8,56.06,56.06,0,0,1-56,56H51.31l10.35-10.34a8,8,0,0,0-11.32-11.32l-24,24a8,8,0,0,0,0,11.32l24,24a8,8,0,0,0,11.32-11.32L51.31,200H160a72.08,72.08,0,0,0,72-72A8,8,0,0,0,224,120Z"
  },
  {
    name: "flag",
    title: "Important task",
    viewBox: "0 0 256 256",
    path: "M42.76,50A8,8,0,0,0,40,56V224a8,8,0,0,0,16,0V179.77c26.79-21.16,49.87-9.75,76.45,3.41,16.4,8.11,34.06,16.85,53,16.85,13.93,0,28.54-4.75,43.82-18a8,8,0,0,0,2.76-6V56A8,8,0,0,0,218.76,50c-28,24.23-51.72,12.49-79.21-1.12C111.07,34.76,78.78,18.79,42.76,50ZM216,172.25c-26.79,21.16-49.87,9.74-76.45-3.41-25-12.35-52.81-26.13-83.55-8.4V59.79c26.79-21.16,49.87-9.75,76.45,3.4,25,12.35,52.82,26.13,83.55,8.4Z"
  }
];

// ../../packages/icons/src/index.ts
var BY_NAME = new Map(
  ROUTINE_ICONS.map((icon) => [icon.name, icon])
);
function findRoutineIcon(name) {
  if (name === null || name === void 0) return void 0;
  return BY_NAME.get(name);
}
function routineIconSvg(name, size = 24) {
  const icon = findRoutineIcon(name);
  if (icon === void 0) return "";
  return `<svg viewBox="${icon.viewBox}" width="${size}" height="${size}" fill="currentColor" aria-hidden="true" focusable="false"><path d="${icon.path}"/></svg>`;
}

// ../../packages/core/src/time.ts
var DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
var WEEKDAYS = [
  "SUNDAY",
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY"
];
function isCalendarDate(value) {
  const match = DATE_PATTERN.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return false;
  }
  const utc = new Date(Date.UTC(year, month - 1, day));
  return utc.getUTCFullYear() === year && utc.getUTCMonth() === month - 1 && utc.getUTCDate() === day;
}
function weekdayName(date) {
  if (!isCalendarDate(date)) return void 0;
  const match = DATE_PATTERN.exec(date);
  if (!match) return void 0;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const weekday = WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
  return weekday;
}
function addDays(date, days) {
  if (!isCalendarDate(date)) return void 0;
  const match = DATE_PATTERN.exec(date);
  if (!match) return void 0;
  const utc = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  );
  utc.setUTCDate(utc.getUTCDate() + days);
  const year = utc.getUTCFullYear().toString().padStart(4, "0");
  const month = (utc.getUTCMonth() + 1).toString().padStart(2, "0");
  const day = utc.getUTCDate().toString().padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// ../../packages/core/src/model.ts
var DAY_PARTS = ["morning", "afternoon", "evening", "night"];

// ../../packages/core/src/recurrence.ts
var WEEKDAY_CODES = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"];
var WEEKDAY_FROM_CODE = {
  SU: 0,
  MO: 1,
  TU: 2,
  WE: 3,
  TH: 4,
  FR: 5,
  SA: 6
};
function weekdayCodeOf(date) {
  if (!isCalendarDate(date)) return void 0;
  return WEEKDAY_CODES.find(
    (candidate) => WEEKDAY_FROM_CODE[candidate] === utcDate(date).getUTCDay()
  );
}
function utcDate(date) {
  return new Date(Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10))));
}

// ../../packages/core/src/presentation.ts
var STATUS_SYMBOL = {
  pending: "\u25CB",
  completed: "\u2713",
  missed: "\u2715",
  skipped: "\u2014"
};
var STATUS_ACCESSIBLE_LABEL = {
  pending: "Pending",
  completed: "Completed",
  missed: "Missed",
  skipped: "Skipped"
};
var DAY_PART_HEADING = {
  morning: "MORNING",
  afternoon: "AFTERNOON",
  evening: "EVENING",
  night: "NIGHT"
};
function formatClock(timestamp) {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}):(\d{2})(Z|[+-]\d{2}:\d{2})?$/.exec(
    timestamp
  );
  const clock = match?.[2];
  if (!clock) return void 0;
  const zone = match?.[4];
  if (zone === "Z") return `${clock} UTC`;
  if (zone) return `${clock} ${zone}`;
  return clock;
}
function weekdayLabel(date) {
  const name = weekdayName(date);
  if (name === void 0) return void 0;
  return name[0] + name.slice(1).toLowerCase();
}

// src/index.ts
var DOMAIN = "autiplanner_saas";
var CARD_TAG = "autiplanner-card";
var STATUSES = ["pending", "completed", "missed", "skipped"];
var MAX_DAYS = 7;
var REPEAT_LABEL = {
  none: "Just once",
  daily: "Every day",
  weekly: "Every week"
};
var _root, _config, _hass, _optimistic, _signature, _busy, _message, _messageIsError, _editorOpen, _draft, _confirmStop, _confirmRemove, _AutiPlannerCard_instances, entityId_fn, signatureOf_fn, render_fn, renderDay_fn, renderPart_fn, renderItem_fn, renderEditor_fn, renderIconChoices_fn, onClick_fn, onSubmit_fn, renderIconGrid_fn, removeItem_fn, onChange_fn, act_fn, create_fn, stopRepeating_fn, service_fn, refresh_fn, syncOptimistic_fn;
var AutiPlannerCard = class extends HTMLElement {
  constructor() {
    super();
    __privateAdd(this, _AutiPlannerCard_instances);
    __privateAdd(this, _root);
    __privateAdd(this, _config, { entity: "", days: 1, showAdd: true, showSummary: true, title: null });
    __privateAdd(this, _hass, null);
    /** Outcomes applied locally, so a tap feels immediate while the poll catches up. */
    __privateAdd(this, _optimistic, /* @__PURE__ */ new Map());
    __privateAdd(this, _signature, "");
    __privateAdd(this, _busy, false);
    __privateAdd(this, _message, "");
    __privateAdd(this, _messageIsError, false);
    __privateAdd(this, _editorOpen, false);
    __privateAdd(this, _draft, { title: "", date: "", dayPart: "morning", time: "", repeat: "none", icon: "" });
    /** The series whose removal is waiting to be confirmed, if any. */
    __privateAdd(this, _confirmStop, null);
    /** The item whose removal is waiting to be confirmed, if any. */
    __privateAdd(this, _confirmRemove, null);
    __privateSet(this, _root, this.attachShadow({ mode: "open" }));
    __privateGet(this, _root).addEventListener("click", (event) => __privateMethod(this, _AutiPlannerCard_instances, onClick_fn).call(this, event));
    __privateGet(this, _root).addEventListener("submit", (event) => __privateMethod(this, _AutiPlannerCard_instances, onSubmit_fn).call(this, event));
    __privateGet(this, _root).addEventListener("change", (event) => __privateMethod(this, _AutiPlannerCard_instances, onChange_fn).call(this, event));
  }
  static getStubConfig(hass) {
    return {
      type: `custom:${CARD_TAG}`,
      entity: (hass === void 0 ? void 0 : findAgendaEntity(hass)) ?? "sensor.routine_agenda",
      days: 1
    };
  }
  static getConfigElement() {
    const element = document.createElement("div");
    return element;
  }
  getCardSize() {
    return __privateGet(this, _config).showAdd ? 5 : 3;
  }
  setConfig(config) {
    const days = typeof config["days"] === "number" ? Math.round(config["days"]) : 1;
    const title = config["title"];
    __privateSet(this, _config, {
      entity: typeof config["entity"] === "string" ? config["entity"].trim() : "",
      days: Math.min(Math.max(days, 1), MAX_DAYS),
      showAdd: config["show_add"] !== false,
      showSummary: config["show_summary"] !== false,
      title: typeof title === "string" && title.trim() !== "" ? title : null
    });
  }
  set hass(hass) {
    __privateSet(this, _hass, hass);
    const signature = __privateMethod(this, _AutiPlannerCard_instances, signatureOf_fn).call(this, hass);
    if (signature !== __privateGet(this, _signature)) {
      __privateSet(this, _signature, signature);
      __privateMethod(this, _AutiPlannerCard_instances, render_fn).call(this);
    }
  }
};
_root = new WeakMap();
_config = new WeakMap();
_hass = new WeakMap();
_optimistic = new WeakMap();
_signature = new WeakMap();
_busy = new WeakMap();
_message = new WeakMap();
_messageIsError = new WeakMap();
_editorOpen = new WeakMap();
_draft = new WeakMap();
_confirmStop = new WeakMap();
_confirmRemove = new WeakMap();
_AutiPlannerCard_instances = new WeakSet();
// ------------------------------------------------------------- rendering
entityId_fn = function() {
  if (__privateGet(this, _config).entity !== "") return __privateGet(this, _config).entity;
  return __privateGet(this, _hass) === null ? "" : findAgendaEntity(__privateGet(this, _hass)) ?? "";
};
signatureOf_fn = function(hass) {
  const entity = __privateGet(this, _config).entity;
  const found = entity === "" ? void 0 : hass.states[entity];
  if (found === void 0) return `${entity}|missing`;
  const items = found.attributes["items"];
  const revision = found.attributes["revision"];
  return `${entity}|${found.state}|${String(revision)}|${Array.isArray(items) ? items.length : -1}`;
};
render_fn = function() {
  const hass = __privateGet(this, _hass);
  const entity = __privateMethod(this, _AutiPlannerCard_instances, entityId_fn).call(this);
  const state = hass === null ? void 0 : hass.states[entity];
  const items = readItems(state);
  __privateMethod(this, _AutiPlannerCard_instances, syncOptimistic_fn).call(this, items);
  const today = localToday(hass?.config.time_zone);
  const days = [];
  for (let offset = 0; offset < __privateGet(this, _config).days; offset += 1) {
    const date = addDays(today, offset);
    if (date !== void 0) days.push(date);
  }
  const effective = items.map((item) => {
    const override = __privateGet(this, _optimistic).get(item.uid);
    return override === void 0 ? item : { ...item, status: override };
  });
  const body = state === void 0 ? `<div class="notice">No AutiPlanner agenda sensor found. Add the
             <strong>AutiPlanner (hosted)</strong> integration, then point this card at
             its agenda sensor.</div>` : days.map((date, index) => __privateMethod(this, _AutiPlannerCard_instances, renderDay_fn).call(this, date, index, effective)).join("");
  const message = __privateGet(this, _message) ? `<div class="message${__privateGet(this, _messageIsError) ? " error" : ""}" role="status">${escape(__privateGet(this, _message))}</div>` : "";
  const issues = readIssues(state);
  const issuesHtml = issues.length === 0 ? "" : `<div class="notice warn">Calendar issues: ${escape(issues.join(", "))}</div>`;
  __privateGet(this, _root).innerHTML = `
      <style>${STYLES}</style>
      <ha-card>
        <div class="bar">
          <div class="title">${escape(__privateGet(this, _config).title ?? "AutiPlanner")}</div>
          <div class="tools">
            <button type="button" class="tool" data-act="refresh" aria-label="Refresh the agenda">&#10227;</button>
            ${__privateGet(this, _config).showAdd ? `<button type="button" class="tool" data-act="toggle-add" aria-label="Add a routine item" aria-expanded="${__privateGet(this, _editorOpen)}">&#65291;</button>` : ""}
          </div>
        </div>
        ${message}
        ${issuesHtml}
        ${__privateGet(this, _editorOpen) ? __privateMethod(this, _AutiPlannerCard_instances, renderEditor_fn).call(this, today) : ""}
        <div class="body">${body}</div>
      </ha-card>`;
};
renderDay_fn = function(date, index, items) {
  const forDay = items.filter((item) => item.date === date);
  const summary = __privateGet(this, _config).showSummary ? renderSummary(forDay) : "";
  const parts = DAY_PARTS.map(
    (dayPart) => __privateMethod(this, _AutiPlannerCard_instances, renderPart_fn).call(this, dayPart, forDay.filter((item) => item.dayPart === dayPart))
  ).join("");
  const empty = forDay.length === 0 ? `<div class="empty">Nothing planned</div>` : "";
  return `<section class="day">
      <div class="day-bar">
        <span class="day-name">${escape(dayName(date, index))}</span>
        ${summary}
      </div>
      ${parts}
      ${empty}
    </section>`;
};
renderPart_fn = function(dayPart, items) {
  if (items.length === 0) return "";
  const rows = items.map((item) => __privateMethod(this, _AutiPlannerCard_instances, renderItem_fn).call(this, item)).join("");
  return `<div class="part">
      <div class="part-label">${escape(DAY_PART_HEADING[dayPart])}</div>
      <ul class="items">${rows}</ul>
    </div>`;
};
renderItem_fn = function(item) {
  const status = item.status;
  const clock = formatClock(item.start ?? item.due ?? "");
  const meta = [STATUS_ACCESSIBLE_LABEL[status], clock].filter((part) => part !== void 0 && part !== "").join(" \xB7 ");
  const disabled = __privateGet(this, _busy) ? " disabled" : "";
  const buttons = actionsFor(status).map(
    (button) => `<button type="button" class="act" data-act="${button.action}" data-uid="${escape(item.uid)}"${disabled}
             aria-label="Mark ${escape(item.title)} ${escape(button.word)}">${button.glyph}</button>`
  ).join("") + `<button type="button" class="act remove" data-act="remove-item" data-uid="${escape(item.uid)}"${disabled}
         aria-label="Remove ${escape(item.title)}">&#10005;</button>`;
  const icon = findRoutineIcon(item.icon);
  const iconHtml = icon === void 0 ? "" : `<span class="icon" title="${escape(icon.title)}">${routineIconSvg(icon.name, 22)}</span>`;
  const repeat = item.routineId === void 0 ? "" : `<button type="button" class="repeat" data-act="stop-repeat" data-series="${escape(item.routineId)}"
             aria-label="Stop repeating ${escape(item.title)}">&#8635;</button>`;
  const acts = __privateGet(this, _confirmRemove) === item.uid ? `<span class="confirm" role="status">
             <span class="confirm-text">Remove?</span>
             <button type="button" class="act" data-act="remove-item-yes" data-uid="${escape(item.uid)}" aria-label="Yes, remove ${escape(item.title)}">Yes</button>
             <button type="button" class="act" data-act="remove-item-no" data-uid="${escape(item.uid)}" aria-label="Keep ${escape(item.title)}">No</button>
           </span>` : item.routineId !== void 0 && __privateGet(this, _confirmStop) === item.routineId ? `<span class="confirm" role="status">
             <span class="confirm-text">Stop repeating?</span>
             <button type="button" class="act" data-act="stop-repeat-yes" data-series="${escape(item.routineId)}" aria-label="Yes, stop repeating ${escape(item.title)}">Yes</button>
             <button type="button" class="act" data-act="stop-repeat-no" aria-label="Keep repeating ${escape(item.title)}">No</button>
           </span>` : `<span class="acts">${buttons}</span>`;
  return `<li class="item" data-status="${status}"${item.routineId === void 0 ? "" : ` data-series="${escape(item.routineId)}"`}>
      <span class="glyph" aria-hidden="true">${STATUS_SYMBOL[status]}</span>
      ${iconHtml}
      <span class="main">
        <span class="name">${escape(item.title)}${repeat}</span>
        <span class="meta">${escape(meta)}</span>
      </span>
      ${acts}
    </li>`;
};
renderEditor_fn = function(today) {
  const draft = __privateGet(this, _draft);
  const date = draft.date === "" ? today : draft.date;
  const options = DAY_PARTS.map(
    (dayPart) => `<option value="${dayPart}"${dayPart === draft.dayPart ? " selected" : ""}>${escape(DAY_PART_HEADING[dayPart])}</option>`
  ).join("");
  const repeats = Object.keys(REPEAT_LABEL).map((choice) => {
    const label = choice === "weekly" ? `Every ${weekdayLabel(date) ?? ""}` : REPEAT_LABEL[choice];
    return `<option value="${choice}"${choice === draft.repeat ? " selected" : ""}${choice === "weekly" ? ' id="ap-repeat-weekly"' : ""}>${escape(label)}</option>`;
  }).join("");
  const note = draft.repeat === "weekly" ? `Repeats every ${weekdayLabel(date) ?? ""}` : draft.repeat === "daily" ? "Repeats every day" : "";
  return `<form class="add" data-form="add">
      <label for="ap-title">New routine item</label>
      <input id="ap-title" name="title" value="${escape(draft.title)}" required maxlength="120" placeholder="Take medication" />
      <div class="grid">
        <div>
          <label for="ap-date">Date <span class="hint">(today if left empty)</span></label>
          <input id="ap-date" name="date" type="date" value="${escape(date)}" />
        </div>
        <div>
          <label for="ap-part">Day part</label>
          <select id="ap-part" name="dayPart">${options}</select>
        </div>
        <div>
          <label for="ap-time">Time (optional)</label>
          <input id="ap-time" name="time" type="time" value="${escape(draft.time)}" />
        </div>
        <div>
          <label for="ap-repeat">Repeats</label>
          <select id="ap-repeat" name="repeat">${repeats}</select>
        </div>
      </div>
      <fieldset class="icons">
        <legend>Icon <span class="hint">(optional)</span></legend>
        <div class="icon-grid" role="radiogroup" aria-label="Routine icon">
          ${__privateMethod(this, _AutiPlannerCard_instances, renderIconChoices_fn).call(this)}
        </div>
      </fieldset>
      <p class="repeat-note"${note === "" ? " hidden" : ""}>${escape(note)}</p>
      <button type="submit"${__privateGet(this, _busy) ? " disabled" : ""}>Add item</button>
      <input type="hidden" name="icon" value="${escape(draft.icon)}" />
    </form>`;
};
/**
 * The picker: the icons the set offers, and nothing else.
 *
 * A grid of buttons rather than a select, because the choice is a picture: a
 * list of names would make the household read all of them to find one. Each
 * button is named by what the icon means, and the chosen one is reported as
 * `aria-checked`, so the state is not carried by the highlight alone.
 */
renderIconChoices_fn = function() {
  const none = `<button type="button" class="icon-choice${__privateGet(this, _draft).icon === "" ? " chosen" : ""}" data-act="pick-icon" data-icon="" role="radio" aria-checked="${__privateGet(this, _draft).icon === ""}" aria-label="No icon" title="No icon">&#8709;</button>`;
  const choices = ROUTINE_ICONS.map((icon) => {
    const chosen = __privateGet(this, _draft).icon === icon.name;
    return `<button type="button" class="icon-choice${chosen ? " chosen" : ""}" data-act="pick-icon" data-icon="${escape(icon.name)}" role="radio" aria-checked="${chosen}" aria-label="${escape(icon.title)}" title="${escape(icon.title)}">${routineIconSvg(icon.name, 20)}</button>`;
  }).join("");
  return none + choices;
};
// --------------------------------------------------------------- events
onClick_fn = function(event) {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const trigger = target.closest("[data-act]");
  if (trigger === null) return;
  const action = trigger.dataset["act"];
  const uid = trigger.dataset["uid"];
  const series = trigger.dataset["series"];
  if (action === "toggle-add") {
    __privateSet(this, _editorOpen, !__privateGet(this, _editorOpen));
    __privateMethod(this, _AutiPlannerCard_instances, render_fn).call(this);
    return;
  }
  if (action === "refresh") {
    void __privateMethod(this, _AutiPlannerCard_instances, refresh_fn).call(this);
    return;
  }
  if (action === "pick-icon") {
    const icon = trigger.dataset["icon"] ?? "";
    __privateSet(this, _draft, { ...__privateGet(this, _draft), icon });
    __privateMethod(this, _AutiPlannerCard_instances, renderIconGrid_fn).call(this);
    return;
  }
  if (action === "stop-repeat") {
    __privateSet(this, _confirmStop, series ?? null);
    __privateMethod(this, _AutiPlannerCard_instances, render_fn).call(this);
    return;
  }
  if (action === "stop-repeat-no") {
    __privateSet(this, _confirmStop, null);
    __privateMethod(this, _AutiPlannerCard_instances, render_fn).call(this);
    return;
  }
  if (action === "remove-item") {
    __privateSet(this, _confirmRemove, uid ?? null);
    return __privateMethod(this, _AutiPlannerCard_instances, render_fn).call(this);
  }
  if (action === "remove-item-no") {
    __privateSet(this, _confirmRemove, null);
    return __privateMethod(this, _AutiPlannerCard_instances, render_fn).call(this);
  }
  if (action === "remove-item-yes") {
    if (uid !== void 0) __privateMethod(this, _AutiPlannerCard_instances, removeItem_fn).call(this, uid);
    return;
  }
  if (action === "stop-repeat-yes") {
    if (series !== void 0) void __privateMethod(this, _AutiPlannerCard_instances, stopRepeating_fn).call(this, series);
    return;
  }
  if (uid === void 0) return;
  const button = actionsFor(findStatus(trigger.closest("li"), __privateGet(this, _optimistic))).find(
    (candidate) => candidate.action === action
  );
  if (button === void 0) return;
  void __privateMethod(this, _AutiPlannerCard_instances, act_fn).call(this, uid, button);
};
onSubmit_fn = function(event) {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const form = target.closest("form[data-form]");
  if (form === null) return;
  event.preventDefault();
  void __privateMethod(this, _AutiPlannerCard_instances, create_fn).call(this, form);
};
/**
 * Keeps the weekday wording in step with the date, in place.
 *
 * The repeat select and the sentence under the form both name the weekday a
 * weekly routine would land on, and that word comes from the date field. Only
 * that text is rewritten: re-rendering the form here would drop focus.
 */
/**
 * Repaints the picker in place after a choice.
 *
 * A full render would rebuild the form and take the cursor out of the title
 * field, which is exactly where a household is likely to be.
 */
renderIconGrid_fn = function() {
  const grid = __privateGet(this, _root).querySelector(".icon-grid");
  if (grid === null) return;
  grid.innerHTML = __privateMethod(this, _AutiPlannerCard_instances, renderIconChoices_fn).call(this);
  const hidden = __privateGet(this, _root).querySelector('input[name="icon"]');
  if (hidden !== null) hidden.value = __privateGet(this, _draft).icon;
};
removeItem_fn = async function(uid) {
  if (__privateGet(this, _busy)) return;
  __privateSet(this, _busy, true);
  __privateSet(this, _message, "");
  __privateSet(this, _messageIsError, false);
  try {
    await __privateMethod(this, _AutiPlannerCard_instances, service_fn).call(this, "delete", { uid });
    __privateSet(this, _confirmRemove, null);
    await __privateMethod(this, _AutiPlannerCard_instances, refresh_fn).call(this);
  } catch (error) {
    __privateSet(this, _message, errorText(error));
    __privateSet(this, _messageIsError, true);
  } finally {
    __privateSet(this, _busy, false);
    __privateMethod(this, _AutiPlannerCard_instances, render_fn).call(this);
  }
};
onChange_fn = function(event) {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const form = target.closest("form[data-form='add']");
  if (form === null) return;
  const data = new FormData(form);
  const icon = String(data.get("icon") ?? "");
  __privateSet(this, _draft, { ...__privateGet(this, _draft), icon });
  const chosen = String(data.get("date") ?? "").trim();
  const date = chosen === "" ? localToday(__privateGet(this, _hass)?.config.time_zone) : chosen;
  const repeat = String(data.get("repeat") ?? "none");
  const weekday = isCalendarDate(date) ? weekdayLabel(date) ?? "" : "";
  const weekly = form.querySelector("#ap-repeat-weekly");
  if (weekly !== null && weekday !== "") {
    weekly.textContent = `Every ${weekday}`;
  }
  const note = form.querySelector(".repeat-note");
  if (note !== null) {
    const text = repeat === "weekly" && weekday !== "" ? `Repeats every ${weekday}` : repeat === "daily" ? "Repeats every day" : "";
    note.textContent = text;
    if (text === "") note.setAttribute("hidden", "");
    else note.removeAttribute("hidden");
  }
};
act_fn = async function(uid, button) {
  if (__privateGet(this, _busy)) return;
  __privateSet(this, _busy, true);
  __privateSet(this, _message, "");
  __privateSet(this, _messageIsError, false);
  try {
    await __privateMethod(this, _AutiPlannerCard_instances, service_fn).call(this, button.action, { uid });
    __privateGet(this, _optimistic).set(uid, button.next);
    await __privateMethod(this, _AutiPlannerCard_instances, refresh_fn).call(this);
  } catch (error) {
    __privateSet(this, _message, errorText(error));
    __privateSet(this, _messageIsError, true);
  } finally {
    __privateSet(this, _busy, false);
    __privateMethod(this, _AutiPlannerCard_instances, render_fn).call(this);
  }
};
create_fn = async function(form) {
  const data = new FormData(form);
  const title = String(data.get("title") ?? "").trim();
  const chosen = String(data.get("date") ?? "").trim();
  const dayPart = String(data.get("dayPart") ?? "morning");
  const time = String(data.get("time") ?? "").trim();
  const repeat = String(data.get("repeat") ?? "none");
  const icon = String(data.get("icon") ?? "");
  if (title === "" || !isDayPart(dayPart)) {
    __privateSet(this, _message, "A title and a day part are required.");
    __privateSet(this, _messageIsError, true);
    __privateMethod(this, _AutiPlannerCard_instances, render_fn).call(this);
    return;
  }
  const date = chosen === "" ? localToday(__privateGet(this, _hass)?.config.time_zone) : chosen;
  if (!isCalendarDate(date)) {
    __privateSet(this, _message, "That date is not a real day.");
    __privateSet(this, _messageIsError, true);
    __privateMethod(this, _AutiPlannerCard_instances, render_fn).call(this);
    return;
  }
  const uid = `ha-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const start = time === "" ? void 0 : `${date}T${time}:00`;
  __privateSet(this, _busy, true);
  __privateSet(this, _message, "");
  __privateSet(this, _messageIsError, false);
  try {
    if (repeat === "none") {
      const payload = {
        uid,
        title,
        date,
        day_part: dayPart,
        status: "pending"
      };
      if (start !== void 0) payload["start"] = start;
      if (icon !== "") payload["icon"] = icon;
      await __privateMethod(this, _AutiPlannerCard_instances, service_fn).call(this, "create", payload);
    } else {
      const payload = {
        uid,
        title,
        date,
        day_part: dayPart,
        recurrence: repeat === "weekly" ? (
          // The weekday comes from the date the household chose, which is
          // what "the same day every week" means on the form.
          { freq: "weekly", byDay: [weekdayCodeOf(date) ?? "MO"] }
        ) : { freq: "daily" }
      };
      if (start !== void 0) payload["start"] = start;
      if (icon !== "") payload["icon"] = icon;
      await __privateMethod(this, _AutiPlannerCard_instances, service_fn).call(this, "add_series", payload);
    }
    __privateSet(this, _draft, { title: "", date, dayPart, time, repeat: "none", icon });
    __privateSet(this, _editorOpen, false);
    await __privateMethod(this, _AutiPlannerCard_instances, refresh_fn).call(this);
  } catch (error) {
    __privateSet(this, _message, errorText(error));
    __privateSet(this, _messageIsError, true);
  } finally {
    __privateSet(this, _busy, false);
    __privateMethod(this, _AutiPlannerCard_instances, render_fn).call(this);
  }
};
stopRepeating_fn = async function(series) {
  if (__privateGet(this, _busy)) return;
  __privateSet(this, _busy, true);
  __privateSet(this, _message, "");
  __privateSet(this, _messageIsError, false);
  try {
    await __privateMethod(this, _AutiPlannerCard_instances, service_fn).call(this, "delete", { uid: series });
    __privateSet(this, _confirmStop, null);
    await __privateMethod(this, _AutiPlannerCard_instances, refresh_fn).call(this);
  } catch (error) {
    __privateSet(this, _message, errorText(error));
    __privateSet(this, _messageIsError, true);
  } finally {
    __privateSet(this, _busy, false);
    __privateMethod(this, _AutiPlannerCard_instances, render_fn).call(this);
  }
};
service_fn = async function(action, data) {
  const hass = __privateGet(this, _hass);
  const entity = __privateMethod(this, _AutiPlannerCard_instances, entityId_fn).call(this);
  if (hass === null) return;
  await hass.callService(DOMAIN, action, { entity_id: entity, ...data });
};
refresh_fn = async function() {
  const hass = __privateGet(this, _hass);
  const entity = __privateMethod(this, _AutiPlannerCard_instances, entityId_fn).call(this);
  if (hass === null || entity === "") return;
  try {
    await hass.callService("homeassistant", "update_entity", { entity_id: entity });
  } catch {
  }
};
/** Drops local overrides the server has caught up with. */
syncOptimistic_fn = function(items) {
  for (const item of items) {
    const override = __privateGet(this, _optimistic).get(item.uid);
    if (override !== void 0 && override === item.status) {
      __privateGet(this, _optimistic).delete(item.uid);
    }
  }
};
function actionsFor(status) {
  if (status === "pending") {
    return [
      { action: "complete", next: "completed", glyph: "\u2713", word: "completed" },
      { action: "mark_missed", next: "missed", glyph: "\u2715", word: "missed" },
      { action: "skip", next: "skipped", glyph: "\u2014", word: "skipped" }
    ];
  }
  return [{ action: "reset", next: "pending", glyph: "\u21BA", word: "pending again" }];
}
function renderSummary(items) {
  const counts = /* @__PURE__ */ new Map();
  for (const item of items) counts.set(item.status, (counts.get(item.status) ?? 0) + 1);
  const parts = [];
  for (const status of ["pending", "completed", "missed", "skipped"]) {
    const count = counts.get(status);
    if (count === void 0 || count === 0) continue;
    parts.push(
      `<span class="chip" data-status="${status}"><span aria-hidden="true">${STATUS_SYMBOL[status]}</span> ${escape(STATUS_ACCESSIBLE_LABEL[status])} ${count}</span>`
    );
  }
  return `<span class="chips">${parts.join("")}</span>`;
}
function findAgendaEntity(hass) {
  for (const [entityId, state] of Object.entries(hass.states)) {
    if (!entityId.startsWith("sensor.") || !entityId.endsWith("_agenda")) continue;
    if (Array.isArray(state.attributes["items"])) return entityId;
  }
  return null;
}
function readItems(state) {
  const raw = state?.attributes["items"];
  if (!Array.isArray(raw)) return [];
  const items = [];
  for (const entry of raw) {
    if (isRoutineItem(entry)) items.push(entry);
  }
  return items;
}
function readIssues(state) {
  const raw = state?.attributes["autiplanner_issues"];
  if (!Array.isArray(raw)) return [];
  return raw.filter((issue) => typeof issue === "string");
}
function isDayPart(value) {
  return DAY_PARTS.includes(value);
}
function isRoutineItem(value) {
  if (typeof value !== "object" || value === null) return false;
  const item = value;
  return typeof item["uid"] === "string" && typeof item["title"] === "string" && typeof item["date"] === "string" && typeof item["dayPart"] === "string" && isDayPart(item["dayPart"]) && typeof item["status"] === "string" && STATUSES.includes(item["status"]);
}
function findStatus(row, optimistic) {
  const element = row instanceof HTMLElement ? row : null;
  const status = element?.dataset["status"];
  return status !== void 0 && STATUSES.includes(status) ? status : "pending";
}
function localToday(timeZone) {
  const now = /* @__PURE__ */ new Date();
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(now);
    const values = {};
    for (const part of parts) {
      if (part.type !== "literal") values[part.type] = part.value;
    }
    const year = values["year"];
    const month = values["month"];
    const day = values["day"];
    if (year !== void 0 && month !== void 0 && day !== void 0) {
      return `${year}-${month}-${day}`;
    }
  } catch {
  }
  return now.toISOString().slice(0, 10);
}
function dayName(date, index) {
  if (index === 0) return "Today";
  if (index === 1) return "Tomorrow";
  const [year, month, day] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
    month: "short"
  }).format(new Date(Date.UTC(year, month - 1, day)));
}
function escape(value) {
  const entities = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  };
  return value.replace(/[&<>"']/g, (character) => entities[character] ?? character);
}
function errorText(error) {
  if (error instanceof Error) return error.message;
  return String(error);
}
var STYLES = `
  ha-card { padding: 12px 16px 16px; }
  .bar { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .title { font-size: 1.15rem; font-weight: 600; color: var(--primary-text-color, #212121); }
  .tools { display: flex; gap: 4px; }
  .tool { background: none; border: none; color: var(--primary-text-color, #212121);
          font-size: 1.1rem; cursor: pointer; min-width: 40px; min-height: 40px; border-radius: 8px; }
  .tool:hover { background: var(--secondary-background-color, #e0e0e0); }
  .day { margin-top: 14px; }
  .day-bar { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
  .day-name { font-weight: 600; color: var(--primary-text-color, #212121); }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; }
  .chip { font-size: 0.78rem; color: var(--primary-text-color, #212121); opacity: 0.85; }
  .part { margin-top: 8px; }
  .part-label { font-size: 0.72rem; letter-spacing: 0.08em; text-transform: uppercase;
                color: var(--secondary-text-color, #727272); }
  .items { list-style: none; margin: 4px 0 0; padding: 0; display: flex; flex-direction: column; gap: 2px; }
  .item { display: flex; align-items: center; gap: 8px; padding: 6px 8px; border-radius: 10px;
          background: var(--card-background-color, #fff); }
  .item[data-status="completed"] { opacity: 0.65; }
  .glyph { font-size: 1rem; width: 1.2em; text-align: center; }
  .main { display: flex; flex-direction: column; flex: 1 1 auto; min-width: 0; }
  .name { color: var(--primary-text-color, #212121); overflow-wrap: anywhere; }
  .meta { font-size: 0.76rem; color: var(--secondary-text-color, #727272); }
  .acts { display: flex; gap: 2px; }
  .act { min-width: 40px; min-height: 40px; border-radius: 10px; cursor: pointer;
         font-size: 1rem; color: var(--primary-text-color, #212121);
         background: var(--secondary-background-color, #ececec); border: none; }
  .act:hover { background: var(--primary-color, #03a9f4); color: #fff; }
  .act:disabled { opacity: 0.5; cursor: default; }
  .repeat { background: none; border: none; cursor: pointer; padding: 0 4px; font-size: 0.9rem;
            color: var(--secondary-text-color, #727272); min-width: 32px; min-height: 32px; }
  .repeat:hover { color: var(--primary-color, #03a9f4); }
  .confirm { display: flex; align-items: center; gap: 4px; }
  .confirm-text { font-size: 0.78rem; color: var(--secondary-text-color, #727272); white-space: nowrap; }
  .add .repeat-note { margin: 0; font-size: 0.78rem; color: var(--secondary-text-color, #727272); }
  .act.remove { color: var(--secondary-text-color, #727272); }
  .act.remove:hover { background: var(--error-color, #db4437); color: #fff; }
  .icon { display: inline-flex; align-items: center; margin-right: 4px;
          color: var(--secondary-text-color, #727272); vertical-align: -3px; }
  .icons { border: none; margin: 0; padding: 0; }
  .icons legend { font-size: 0.78rem; color: var(--secondary-text-color, #727272); padding: 0; }
  .icon-grid { display: flex; flex-wrap: wrap; gap: 2px; max-height: 168px; overflow-y: auto;
               padding: 4px; border: 1px solid var(--divider-color, #e0e0e0); border-radius: 8px; }
  .icon-choice { display: inline-flex; align-items: center; justify-content: center;
                 width: 40px; height: 40px; border-radius: 8px; cursor: pointer;
                 border: 1px solid transparent; background: none;
                 color: var(--primary-text-color, #212121); }
  .icon-choice:hover { background: var(--secondary-background-color, #ececec); }
  .icon-choice.chosen { border-color: var(--primary-color, #03a9f4);
                        background: var(--secondary-background-color, #ececec); }
  .empty { font-size: 0.85rem; color: var(--secondary-text-color, #727272); padding: 4px 8px; }
  .message, .notice { margin-top: 10px; font-size: 0.85rem; padding: 8px 10px; border-radius: 8px;
                      background: var(--secondary-background-color, #ececec);
                      color: var(--primary-text-color, #212121); }
  .message.error, .notice.warn { background: var(--error-color, #db4437); color: #fff; }
  .add { margin-top: 12px; display: flex; flex-direction: column; gap: 6px; }
  .add label { font-size: 0.78rem; color: var(--secondary-text-color, #727272); }
  .add .hint { font-weight: 400; opacity: 0.75; }
  .add input, .add select { width: 100%; box-sizing: border-box; padding: 8px;
      border-radius: 8px; border: 1px solid var(--divider-color, #e0e0e0);
      background: var(--card-background-color, #fff); color: var(--primary-text-color, #212121);
      font-size: 0.95rem; min-height: 40px; }
  .add .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 8px; }
  .add button { align-self: flex-start; min-height: 40px; padding: 0 16px; border-radius: 8px;
      border: none; cursor: pointer; font-size: 0.95rem;
      background: var(--primary-color, #03a9f4); color: #fff; }
`;
if (typeof customElements !== "undefined" && customElements.get(CARD_TAG) === void 0) {
  customElements.define(CARD_TAG, AutiPlannerCard);
}
if (typeof window !== "undefined") {
  const registry = window;
  registry.customCards = [
    ...registry.customCards ?? [],
    {
      type: CARD_TAG,
      name: "AutiPlanner card",
      description: "View and change routine items, and add new ones.",
      preview: false
    }
  ];
}
var index_default = AutiPlannerCard;
export {
  AutiPlannerCard,
  actionsFor,
  dayName,
  index_default as default,
  findAgendaEntity,
  isDayPart,
  localToday,
  readIssues,
  readItems,
  renderSummary
};
