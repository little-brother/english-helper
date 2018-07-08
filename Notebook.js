// ==UserScript==
// @name Notebook
// @namespace EnglishHelper
// @description Use F2 to store a selection and Ctrl + F2 to view/hide list of stored item
// @version 1.0
// @grant GM.getValue
// @grant GM.setValue
// @grant GM.listValues
// @grant GM.deleteValue 
// ==/UserScript==
(function (window, undefined) {

var css = `
#notebook-hint {position: fixed; padding: 0; z-index: 10000; top: 0; max-width: 400px; width: 400px; display: none; font-size: 14px; font-family: Tahoma !important; }
#notebook-hint #phrase {display: block; text-align: left; font-size: 24px; font-family: Tahoma !important; border: 1px solid #bbb; margin: 0; width: 100%; background: white; padding: 5px; margin: 0; min-height: 30px;}

#notebook-list {position: fixed; padding: 0; margin: 0; z-index: 5000; top: 0; left: 0; right: 0; bottom: 0; display: none; background: white; font-size: 14px; font-family: Tahoma !important; background: #eee;}
#notebook-list #notebook-header {margin-bottom: 10px; border-bottom: 1px solid #bbb; background: white;}
#notebook-list #notebook-header > * {padding: 5px 10px; display: inline-block; cursor: pointer; font-family: Tahoma !important;}
#notebook-list #notebook-header input {display: none;}
#notebook-list #notebook-header input:checked + label {background: #eee;}
#notebook-list #notebook-header #tags {padding: 0;}
#notebook-list #notebook-header #tags div {display: inline-block; padding: 5px; font-family: Tahoma !important;}
#notebook-list #notebook-header #tags div[current] {background: #eee;}
#notebook-list #notebook-header #close {float: right; margin-left: 20px;}
#notebook-list #notebook-header #search {display: inline-block; margin: 0 20px; padding: 3px 5px; border: 1px solid #bbb; cursor: initial; width: 150px;}

#notebook-list #notebook-header #menu-button {font-size: 14px; border: none; cursor: pointer; padding: 5px;}
#notebook-list #notebook-header #menu {position: relative; display: inline-block; float:right; margin: 0; padding: 0;}
#notebook-list #notebook-header #menu-content {display: none; position: absolute; background-color: #f9f9f9; min-width: 70px; box-shadow: 0px 8px 16px 0px rgba(0,0,0,0.2); z-index: 1;}

#notebook-list #notebook-header #menu:hover #menu-content {display: block;}
#notebook-list #notebook-header #menu:hover #menu-content > div {display: block; padding: 5px; font-family: Tahoma !important;}
#notebook-list #notebook-header #menu:hover #menu-content > div:hover {background: #eee;}
#notebook-list #notebook-header #menu:hover {background-color: #eee;}

#notebook-list #phrases {overflow: auto; position: absolute; top: 33px; left: 0; right: 0; bottom: 0;} 
#notebook-list #phrases[action = "play"] .play {display: inline-block;}
#notebook-list #phrases[action = "edit"] .edit {display: inline-block;}
#notebook-list #phrases[action = "remove"] .remove {display: inline-block;}

#notebook-list .phrase {display: inline-block; margin: 5px;  box-shadow: 3px 3px 3px rgba(0,0,0,0.1); background: white; }
#notebook-list .phrase:not([title=""]) {background: #eef; }
#notebook-list .phrase div {display: inline-block; padding: 5px 10px; white-space: nowrap; font-family: Tahoma !important;}
#notebook-list .phrase div * {display: inline-block; padding: 0;}
#notebook-list .phrase .content {width: initial;}
#notebook-list .phrase .action {border-left: 1px dashed #bbb; cursor: pointer; display: none; line-height: 17px; width: 7px;}
`;

var $style = document.createElement('style');
$style.type = 'text/css';
$style.appendChild(document.createTextNode(css));
document.head.appendChild($style);

var $hint = document.createElement('div');
$hint.id = 'notebook-hint';
document.body.appendChild($hint);
  
var $input = document.createElement('div');
$input.id = 'phrase';
$input.contentEditable = true;
$input.setAttribute('spellcheck', 'false'); 
$input.onclick = (event) => event.stopImmediatePropagation(); 
$input.addEventListener('keydown', onHintInput);  
$hint.appendChild($input);  
  
var $list = document.createElement('div');
$list.id = 'notebook-list';
$list.innerHTML = `
<div id = "notebook-header">
	<input type = "radio" id = "notebook-control-play" name = "control-action" value = "play" checked autocomplete = "off"><label for = "notebook-control-play"  title = "Play sound">&#9834;</label>
	<input type = "radio" id = "notebook-control-edit" name = "control-action" value = "edit" autocomplete = "off"><label for = "notebook-control-edit">&#9997;</label>
	<input type = "radio" id = "notebook-control-remove" name = "control-action" value = "remove" autocomplete = "off"><label for = "notebook-control-remove">x</label>

	<input type = "radio" id = "notebook-control-newest" name = "control-sort" value = "newest" checked autocomplete = "off"><label for = "notebook-control-newest" style = "margin-left: 20px;">Newest</label>
	<input type = "radio" id = "notebook-control-shuffle" name = "control-sort" value = "shuffle" autocomplete = "off"><label for = "notebook-control-shuffle">Shuffle</label>
	<input type = "radio" id = "notebook-control-oldest" name = "control-sort" value = "oldest" autocomplete = "off"><label for = "notebook-control-oldest">Oldest</label>

	<input id = "search" placeholder = "Search">
	<div id = "tags"></div>
	<div id = "close">x</div>
	<div id = "menu">
		<div id = "menu-button">Etc</div>
		<div id = "menu-content">
			<div id = "import">Import</div>
			<div id = "export">Export</div>
			<div id = "clear-all">Clear all</div>
		</div>
	</div>
	<input type = "file" id = "notebook-upload" name = "upload" />
</div>
<div id = "phrases"></div>
`;
document.body.appendChild($list);

var $phrases = $list.querySelector('#phrases');

$list.querySelector('input#notebook-control-oldest').addEventListener('change', sortList);
$list.querySelector('input#notebook-control-newest').addEventListener('change', sortList);  
$list.querySelector('input#notebook-control-shuffle').addEventListener('change', shuffleList);
  
$list.querySelector('input#notebook-control-play').addEventListener('change', updateAction);  
$list.querySelector('input#notebook-control-edit').addEventListener('change', updateAction);
$list.querySelector('input#notebook-control-remove').addEventListener('change', updateAction);
function updateAction (e) {
	listAction = this.id.substring(this.id.lastIndexOf('-') + 1);	
	$list.querySelector('#phrases').setAttribute('action', listAction);
}  

$list.querySelector('input#search').addEventListener('keydown', updateList);
$list.querySelector('#close').addEventListener('click', hideList);
  
$list.querySelector('#notebook-upload').addEventListener('change', importData, true);
$list.querySelector('#import').addEventListener('click', () => $list.querySelector('#notebook-upload').click());
$list.querySelector('#export').addEventListener('click', exportData);
$list.querySelector('#clear-all').addEventListener('click', clearData);

var mouseX = null;
var mouseY = null;
var ctrlKey = false;  

document.addEventListener('mousemove', onMouseUpdate, false);
document.addEventListener('mouseenter', onMouseUpdate, false);
 
function onMouseUpdate(event) {
	mouseX = event.clientX;
	mouseY = event.clientY;
	ctrlKey = event.ctrlKey;
}
  
  
document.addEventListener('keydown', (event) => event.keyCode == 113 && !event.ctrlKey ? showHint(getSelectedText()) : '');
document.addEventListener('keydown', (event) => !(event.keyCode == 113 && event.ctrlKey) ? '' : !$list.style.display || $list.style.display == 'none' ? showList() : hideList());

function onHintInput (event) {
	if (event.keyCode == 27) //Escape
		return $hint.style.display = 'none';
	
	if (event.keyCode == 113 || event.keyCode == 13 && event.ctrlKey) // F2, Ctrl + Enter
		return sync(function () {
			$hint.style.display = 'none';
			var id = $hint.getAttribute('ref');
			saveItem ($input.innerHTML, id, $hint.getAttribute('time'), function (data) {
				if ($list.style.display != 'block')
					return;
					
				var $e =  $phrases.querySelector('#' + data.id);
				
				if (!$e) { 
					$e = createItem(data);

					if ($list.querySelector('#notebook-control-newest').checked) 
						$phrases.insertBefore($e, $phrases.children[0]) 
					else
						$phrases.appendChild($e);
				} else {
					$e.querySelector('.content').innerHTML = data.phrase;
					$e.setAttribute('tags', data.tags.join(' '));
				}

				updateTags();
			});
		});
	
	
	if ([66, 73, 85].indexOf(event.keyCode) != '-1' && event.ctrlKey) { // b, i, u
		event.preventDefault(); 
		event.stopPropagation();
	
		var commands = {66: 'bold', 73: 'italic', 85: 'underline'};
		document.execCommand(commands[event.keyCode], false);
		$input.focus();
	}
	
	if ([49, 50, 51].indexOf(event.keyCode) != -1 && (event.ctrlKey || event.altKey)) { // 1, 2, 3
		event.preventDefault(); 
		event.stopPropagation();
	
		var colors = {
			true: {49: 'red', 50: 'green', 51: 'black'},
			false: {49: 'rgb(255,220, 220)', 50: 'rgb(200,255,220)', 51: 'white'}
		}
		document.execCommand(event.ctrlKey ? 'forecolor' : 'backcolor', false, colors[event.ctrlKey][event.keyCode]);
		$input.focus();  
	}

	fixHintPosition(true); 
}

var phrases = []; 
var listTag = 'all'; 
var listAction = 'play';  

function showHint(phrase, id, time) {
	if (!phrase)
		return;
	
	$input.innerHTML = phrase;
	$hint.style.display = 'block';
	$hint.setAttribute('ref', id || '');
	$hint.setAttribute('time', time || '');
	$input.focus();
	fixHintPosition(); 
}

function showList(show) {
	sync(function () {
		$phrases.innerHTML = '';	
		$phrases.setAttribute('action', listAction);		
		phrases.map(createItem).forEach((e) => $phrases.appendChild(e)); 

		$list.style.display = 'block';
		sortList();
		updateTags();
		updateList();
	})
}

function hideList() {
    $list.style.display = 'none';
}

function sortList () {
	var sorter = ($a, $b) => +$a.getAttribute('time') - $b.getAttribute('time');
	var $arr = Array.from($phrases.querySelectorAll('.phrase')).sort(sorter); 
	
	if ($list.querySelector('input[name="control-sort"]:checked').id == 'notebook-control-newest')
		$arr.reverse();
	
	$phrases.innerHTML = '';
	$arr.forEach(($e) => $phrases.appendChild($e));
}

function shuffleList () {
	for (var i = $phrases.children.length; i >= 0; i--) 
		$phrases.appendChild($phrases.children[Math.random() * i | 0]);
}

function updateList() {
	var search = $list.querySelector('#search').value || '';
	Array.from($phrases.querySelectorAll('.phrase')).forEach(function ($e) {
		var tags = $e.getAttribute('tags').split(' ');
		
		$e.style.display = (listTag == 'all' || tags.indexOf(listTag) != -1) && (!search || $e.textContent.indexOf(search) != -1)? 'inline-block' : 'none';
	});  
} 
  
function createItem(data) {
	var $div = document.createElement('div');
	$div.innerHTML = '<div id = "ID" class = "phrase" title = "COMMENT" time = "TIME" length = "LENGTH" tags = "TAGS"><div class = "content">PHRASE</div><div class = "play action">&#9834;</div><div class = "edit action">&#9997;</div><div class = "remove action">x</div></div>'
		.replace('ID', data.id || 0)
		.replace('TIME', data.time || 0)
		.replace('LENGTH', (data.phrase || '').split(/\b\W+\b/).length)
		.replace('COMMENT', data.comment || '')
		.replace('PHRASE', data.phrase || '')
		.replace('TAGS', (data.tags || []).join(' '));

	var $e = $div.children[0];
	$e.querySelector('.play').addEventListener('click', playItem);
	$e.querySelector('.edit').addEventListener('click', editItem);
	$e.querySelector('.remove').addEventListener('click', removeItem); 

	return $e;
}
  
function saveItem (html, id, time, cb) {
	var unTags = /#([^\s]*)/g;
	var unComment = /{(.*)}/g;  
	var getTags = /(?:^|\s)(?:#)([a-zA-Z\d]+)/gm;
	var getComment = /{([^)]+)}/gm;

	var phrase = (html || '').replace(unTags, '').replace(unComment, '').replace(/\s\s+/g, ' ').trim();
	var tags = [];
	var match;
	
	while ((match = getTags.exec(html))) 
		tags.push(match[1]);
	

	var comment = getComment.exec(html);
	if (comment && comment instanceof Array)
		comment = comment[1];

	var data = {
		id: id || ('phrase-' + hash(html)),
		phrase,
		source: html,
		tags: tags.map((e) => e.toLowerCase()),
		comment: comment || '',
		time: time || new Date().getTime()
	}

	GM.setValue(data.id, JSON.stringify(data))
		.then(function () {
			if (!id)	
				return phrases.push(data);

			var index = phrases.findIndex((e) => e && e.id == id);
			if (index != -1) 
				phrases[index] = data;
			else
				phrases.push(data);
		})
		.then(() => cb ? cb(data) : '');
}
  
function sync (cb) {
	var $body = document.querySelector('body');
	$body.style.cursor = 'wait';

	function onDone(result) {
		result.forEach(function (val) {
			try {
				phrases.push(JSON.parse(val));
			} catch (err) { }
		})

		$body.style.cursor = 'default';
		return cb();
	}
  
	GM.listValues().then(function (res) {
		if (res.length == phrases.length && res.join('').length == phrases.map((e) => e.id).join('').length) {
			$body.style.cursor = 'default';
			return cb();
		}
    
		phrases = [];
		Promise.all(res.map((e) => GM.getValue(e))).then(onDone);
	});
}  
  
function removeItem(event) {
	var $e = event.originalTarget.closest('.phrase') || {};
	var id = $e.id;
	
	var index = phrases.findIndex((e) => e && e.id == id);
	if (index !== -1) 
		phrases.splice(index, 1);
	
	$e.remove();
	GM.deleteValue(id).then(updateTags);
}
  
function playItem(event) {
	var text = event.originalTarget.closest('.phrase').querySelector('.content').textContent;
	var words = text.split(/[ ,]+/);
	
	function playOne(i) {
		if (i == words.length)
			return;
		
		var evt = new CustomEvent('play-word-audio', {detail: JSON.stringify({word: words[i], ctrlKey: event.ctrlKey})});
		document.dispatchEvent(evt);
		setTimeout(() => playOne(i + 1), 1000);
	}
	
	playOne(0);
}
   
function editItem (event) {
	var id = event.originalTarget.closest('.phrase').id;
	var phrase = phrases.find((e) => e.id == id);
	showHint(phrase.source, id, phrase.time);
} 

function updateTags() {
	var tags = {};
	phrases.forEach((e) => e.tags.forEach((t) => tags[t] = true));

	var $tags = $list.querySelector('#tags');
	$tags.innerHTML = '';
	tags = Object.keys(tags);
	tags.sort();
	['all'].concat(tags).map(createTag).forEach((e) => $tags.appendChild(e));	
}

function createTag (tag) {
	var $div = document.createElement('div');
	$div.innerHTML = '<div>' + tag + '</div>';

	var $e = $div.children[0];
	if (tag == listTag)
		$e.setAttribute('current', true);

	$e.addEventListener('click', function () {
		var curr = $list.querySelector('#tags *[current]');
		if (curr)
			curr.removeAttribute('current');
		this.setAttribute('current', true);
		listTag = this.textContent;
		
		updateList();
	});

	return $e;  
} 
  
function importData () {
	var reader = new FileReader();
	var textFile = this.files[0];
	$list.style.cursor = 'wait';
	
	reader.onload = function (res) {
		var lines = (reader.result || '').split('\n').filter((e) => !!e);
		
		function saveOne(i) {
			if (i == lines.length) {
				$list.style.cursor = 'default';
				alert('Done with ' + i + ' records');
				showList();
				return;
			}
			
			var line = lines[i] || '';  
			var index = line.indexOf('\t');
			if (index != -1)
				saveItem (line.substring(index + 1), null, line.substring(0, index), () => saveOne(i + 1))
			else
				saveItem (line, null, null, () => saveOne(i + 1))
		}
		saveOne(0);	
	}
	reader.readAsText(textFile);    
} 
  
function exportData() {
	sync(function () {
		var data = phrases.sort((a, b) => a.time - b.time).map((e) => e.time + '\t' + e.source).join('\n');
		try {
			var uploader = document.createElement('a');
			uploader.href = URL.createObjectURL(new Blob([data], {type: 'text/csv'}));
			uploader.download = 'notes.txt';
			
			document.body.appendChild(uploader);
			uploader.click();
			uploader.remove();    
		} catch (err) { 
			console.log(err);
		}  
	});
}  

function clearData() {
    GM.listValues().then(function (res) {      
      var deleteValue = (i) => (i == res.length) ? cb() : GM.deleteValue(res[i]).then(() => deleteValue(i + 1));
      deleteValue(0);
    });
  
  	$phrases.innerHTML = '';
} 

function fixHintPosition(stick) {
	var x = !stick ? mouseX - 5 : parseInt($hint.style.left);
	if (x + $hint.clientWidth > window.innerWidth)
		x = window.innerWidth - $hint.clientWidth - 30;
	$hint.style.left = x + 'px';

	var y = !stick ? mouseY - 5 : parseInt($hint.style.top);
	if (y + $hint.clientHeight > window.innerHeight)
		y = window.innerHeight - $hint.clientHeight - 5;
	$hint.style.top = y + 'px';
}
  
function hash (str) {
	var hash = 0, i, chr;
	if (str.length === 0) 
		return hash;

	for (i = 0; i < str.length; i++) {
		chr = str.charCodeAt(i);
		hash = ((hash << 5) - hash) + chr;
		hash |= 0;
	}

	return hash;
};

function getSelectedText () {
	var selection = window.getSelection();
	var text = selection.toString().trim();
	selection.removeAllRanges();
	return text;
}  
 
})(window);