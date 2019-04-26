
// Make connection
var socket = io.connect('http://localhost:4000');
suppresser = false;

//quill
var quill = new Quill('#editor', {
    modules: { toolbar: '#toolbar-container' },
    theme: 'snow'
});

socket.on('updated_para', function (data) {
    var ops = JSON.parse(data);
    quill.updateContents(ops.ops);
});

socket.on('html', function (data) {
    var qlEditor = document.querySelector('.ql-editor');
    suppresser = true;
    qlEditor.innerHTML = data;
});

quill.on('text-change', function (delta, oldDelta, source) {
    if (suppresser) { suppresser = false; return; }
    if (source == 'user') {
        var para = quill.getContents();
        let str = quill.container.innerHTML;
        let html = str.slice(str.indexOf('>') + 1, str.indexOf('</div><div class="ql-clipboard"'))
        socket.emit('para', { delta: JSON.stringify(delta) }, html);
    }
});

// chat
var message = document.getElementById('message'),
    handle = document.getElementById('handle'),
    btn = document.getElementById('send'),
    output = document.getElementById('output'),
    feedback = document.getElementById('feedback');

btn.addEventListener('click', function () {
    socket.emit('chat', {
        message: message.value,
        handle: handle.value
    });
    message.value = "";
});

message.addEventListener('keypress', function () {
    socket.emit('typing', handle.value);
})

socket.on('chat', function (data) {
    feedback.innerHTML = 'Chat';
    output.innerHTML += '<strong class="text-info">' + data.handle + ': </strong>' + '<p class="text-muted">' + data.message + '</p>';
    output.scrollTop = output.scrollHeight;
});

socket.on('typing', function (data) {
    feedback.innerHTML = '<small><em>' + data + ' typing..</em></small>';
    setTimeout(() => { feedback.innerHTML = 'Chat'; }, 1000);
});

//iframe

let iframe = document.getElementById('screen-iframe');
let iframeBtn = document.getElementById('btn-iframe');
iframeBtn.addEventListener('click', () => {
    if (iframe.style.position == 'static') {
        iframe.style.background = 'black'
        iframe.style.position = 'fixed';
    }
    else {
        iframe.style.background = 'none'
        iframe.style.position = 'static';
    }
});

//code-editor

var editor = ace.edit("code-editor");
editor.setTheme("ace/theme/monokai");
editor.session.setMode("ace/mode/css");

const codeDocument = document.querySelector('#code-document');
const codeTheme = document.querySelector('#code-theme');
const codeEditor = document.querySelector('#code-editor');

codeDocument.addEventListener('change', (event) => {
    editor.session.setMode("ace/mode/"+event.target.value);
});

codeTheme.addEventListener('change', (event) => {
    editor.setTheme("ace/theme/"+event.target.value);
});

socket.on('doc', (data)=> {
    editor.setValue(data);
});

codeEditor.addEventListener("keyup", ()=>{
    socket.emit('editDoc', editor.getValue());
});



