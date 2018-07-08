// ==UserScript==
// @name LinguaLeo
// @namespace EnglishHelper
// @description Double-click or made a selection and press F1 with Control to translate the word
// @version 1.4
// @grant GM.xmlHttpRequest
// @grant GM.getValue
// @grant GM.setValue
// ==/UserScript==
(function (window, undefined) {

var version = parseFloat(GM.info.script.version);

var css = `
#lingualeo-hint {position: fixed; background: white; padding: 20px;  padding-bottom: 5px; font-size: 14px; font-family: Arial; cursor: default; border: 1px solid #bbb; z-index: 10000; top: 0; max-width: 400px; width: 400px; display: none;}
#lingualeo-hint #word {display: block; text-align: center; font-size: 24px; border: none; border-bottom: 1px solid #bbb; margin: 0; width: 100%}
#lingualeo-hint #transcription {text-align: center; color: #666; font-size: 20px;}
#lingualeo-hint #transcription:empty {margin-bottom: 10px;}
#lingualeo-hint #means {text-align: left; overflow-y: auto; font-size: 14px; text-transform: lowercase;}
#lingualeo-hint #means ul {margin-left: 10px; padding: 0;}
#lingualeo-hint #means ul li {margin: 5px; list-style: disc; padding: 0;}
`;

var $style = document.createElement('style');
$style.type = 'text/css';
$style.appendChild(document.createTextNode(css));
document.head.appendChild($style);

var $hint = document.createElement('div');
$hint.id = 'lingualeo-hint';
document.body.appendChild($hint);

$hint.addEventListener('mouseleave', () => $hint.style.display = 'none');


var $input = document.createElement('input');
$input.id = 'word';
$input.onclick = (event) => event.stopImmediatePropagation(); 
$input.onkeydown = (event) => event.key == 'Enter' ? showHint($input.value, true) : '';
$hint.appendChild($input);

var $transcription = document.createElement('div');
$transcription.id = 'transcription';
$hint.appendChild($transcription);

var $means = document.createElement('div');
$means.id = 'means';
$hint.appendChild($means);

var mouseX = null;
var mouseY = null;

document.addEventListener('mousemove', onMouseUpdate, false);
document.addEventListener('mouseenter', onMouseUpdate, false);

function onMouseUpdate(event) {
	mouseX = event.clientX;
	mouseY = event.clientY;
}

function getSelectedText () {
	var selection = window.getSelection();
	var text = selection.toString().trim();
	selection.removeAllRanges();
	return text;
}

document.addEventListener('dblclick', (event) => event.ctrlKey ? showHint(getSelectedText()) : '');
document.addEventListener('keydown', (event) => event.key == 'F1' && event.ctrlKey ? showHint(getSelectedText()) : '');
document.addEventListener('keydown', (event) => event.key == 'Escape' ? $hint.style.display = 'none' : '');

function showHint(word, stick) {
	if (!word)
		return;
	
	getWord(word, function (err, data) {
		if (err)
			return console.log(err);
		
		$input.value = data.word;
		$transcription.innerHTML = data.transcription || '';
		$means.innerHTML = data.means.length > 1 ? '<ul>' + data.means.map((mean) => '<li>' + mean + '</li>').join('\n') + '</ul>' : data.means[0]; 
		
		$hint.oncontextmenu = () => playUrl(data.audio) || false;
		$hint.style.display = 'block';
		
		var x = !stick ? mouseX - 5 : parseInt($hint.style.left);
		if (x + $hint.clientWidth > window.innerWidth)
			x = window.innerWidth - $hint.clientWidth - 10;
		$hint.style.left = x + 'px';
	
		var y = !stick ? mouseY - 5 : parseInt($hint.style.top);
		if (y + $hint.clientHeight > window.innerHeight)
			y = window.innerHeight - $hint.clientHeight - 5;
		$hint.style.top = y + 'px';
		
		playUrl(data.audio);
	});
}

var words = {};

function getWord(word, callback) {
	var data = words[word];
	if (data) 
		return callback(null, data);

	function onload (response) {
		var res = response.responseText;
		try {
			res = JSON.parse(res).userdict3;
		} catch (err) {
			res = undefined;
		}

		if (!res || !res.translations) {
			return GM.xmlHttpRequest({
				method: 'POST',
				url: 'https://translate.yandex.net/api/v1.5/tr.json/translate?key=trnsl.1.1.20180618T185454Z.6648aed2c29cd85f.f5e63f885e93675e319a3c0f7c916a6588261b32&lang=en-ru&text=' + encodeURI(word),
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded'
				},
				onload: function (response) {
					try {
						var res = JSON.parse(response.responseText);
						callback(null, {word, means: res.text});
					} catch (err) { 
						callback(err);
					}
				}
			});
		}
		
		var data = {
			word, 
			means: res.translations && res.translations
				.sort((a, b) => b.translate_votes - a.translate_votes)
				.map((e) => e.translate_value.trim())
				.filter((e, i, arr) => arr.indexOf(e) == i) || [], 
			audio: res.sound_url, 
			transcription: res.transcription, 
			version
		};
		GM.setValue(word, JSON.stringify(data)).then(() => '');
		words[word] = data;

		console.log('Load: ', word);
		callback(null, data);
	}

	GM.getValue(word).then(function (data) {
		try {
			data = JSON.parse(data);
			if (data.version != version)	
				throw new Error();
			return callback(null, data);
		} catch (err) {
			GM.xmlHttpRequest({
				method: 'GET', 
				url: 'http://lingualeo.com/userdict3/getTranslations?word_value=' + encodeURI(word.toLowerCase()), 
				onload
			});
		}	
	});
}

var sounds = {};
var audioCtx = new AudioContext();

function playUrl(url) {
	if (!url)
		return;
	
	if (sounds[url]) {
		var source = audioCtx.createBufferSource();
		source.buffer = sounds[url];
		source.connect(audioCtx.destination);
		source.start(0);
		return;
	} 
	
	var request = new XMLHttpRequest();
	request.open('GET', url);
	request.responseType = 'arraybuffer';
	request.onload = function() {
			audioCtx.decodeAudioData(request.response, function(data) {
			sounds[url] = data;
			playUrl(url);
		}, function(e) {
			//console.error('Error while decoding audio' + e.err)
		})
	}
	
	request.send();
}

document.addEventListener('play-word-audio', function (event) {
	var data = JSON.parse(event.detail);
	if (data.ctrlKey && data.word)
		getWord(data.word, (err, data) => !err ? playUrl(data && data.audio) : '');
}, false);

})(window);