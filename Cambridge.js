// ==UserScript==
// @name Cambridge
// @namespace EnglishHelper
// @description Double-click or made a selection and press F1 to get the meaning of the word from Cambridge dictionary
// @version 1.5
// @grant GM.xmlHttpRequest
// @grant GM.getValue
// @grant GM.setValue
// ==/UserScript==
(function (window, undefined) {

var version = parseFloat(GM.info.script.version);

var css = `
#cambridge-hint {position: fixed; background: white; padding: 20px; font-size: 14px; font-family: Tahoma !important; cursor: default; border: 1px solid #bbb; z-index: 10000; top: 0; max-width: 400px; width: 400px; display: none;}
#cambridge-hint #word {display: block; text-align: center; font-size: 24px; border: none; border-bottom: 1px solid #bbb; margin: 0; width: 100%}
#cambridge-hint #transcription {text-align: center; color: #666; font-size: 20px; font-family: Tahoma !important;}
#cambridge-hint #suggestions {text-size: 14px; font-family: Tahoma !important; margin: 0; margin-left: 10px; padding: 0; }
#cambridge-hint #suggestions li {margin: 5px; list-style: disc; padding: 0;} 
#cambridge-hint #inflection {text-align: center; color: #666; font-size: 10px; font-family: Tahoma !important;}
#cambridge-hint #inflection span.inf {color: #000; font-size: 14px; font-family: Tahoma !important; font-weight: bold;}
#cambridge-hint #means {text-align: left; overflow-y: auto;}
#cambridge-hint #means summary {margin: 5px 0; display: list-item;}
#cambridge-hint #means summary .mean {font-size: 14px; font-family: Tahoma !important; text-transform: lowercase; font-weight: bold; color: #666;}
#cambridge-hint #means summary .mean.noun {color: green;}
#cambridge-hint #means summary .mean.verb {color: red;}
#cambridge-hint #means summary .mean.adverb {color: gold;}
#cambridge-hint #means summary .mean.adjective {color: blue;}
#cambridge-hint #means summary .mean.preposition {color: purple;}
#cambridge-hint #means summary .pos {font-size: 10px; font-family: Tahoma !important; color: #666; margin: 0 10px; }
#cambridge-hint #means summary .transcription {font-size: 14px; font-family: Tahoma !important; color: #666; float: right; font-weigth: bold;}
#cambridge-hint #means details .description {font-size: 10px; font-family: Tahoma !important; padding: 5px 0; }
#cambridge-hint #means details .description:nth-child(odd) {background: #fafafa;}
#cambridge-hint #uri {position: absolute; right: 5px; bottom: 5px; font-size: 10px; font-family: Tahoma !important;}
#cambridge-hint #suggestions:not(:empty) ~ #uri {display: none;}
`;

console.log('LOAD')

var $style = document.createElement('style');
$style.type = 'text/css';
$style.appendChild(document.createTextNode(css));
document.head.appendChild($style);

var $hint = document.createElement('div');
$hint.id = 'cambridge-hint';
document.body.appendChild($hint);

$hint.addEventListener('mouseleave', () => $hint.style.display = 'none');
$hint.addEventListener('onmousewheel', (event) => event.preventDefault());

var $input = document.createElement('input');
$input.id = 'word';
$input.onclick = (event) => event.stopImmediatePropagation(); 
$input.onkeydown = (event) => event.key == 'Enter' ? showHint($input.value, true) : '';
$hint.appendChild($input);

var $transcription = document.createElement('div');
$transcription.id = 'transcription';
$hint.appendChild($transcription);

var $suggestions = document.createElement('ul');
$suggestions.id = 'suggestions';
$hint.appendChild($suggestions);

var $inflection = document.createElement('div');
$inflection.id = 'inflection';
$hint.appendChild($inflection);

var $means = document.createElement('div');
$means.id = 'means';
$hint.appendChild($means);

var $url = document.createElement('a');
$url.id = 'uri';
$url.setAttribute('target', '_blank');
$url.textContent = 'Cambridge';
$hint.appendChild($url);

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

document.addEventListener('dblclick', (event) => !event.ctrlKey ? showHint(getSelectedText ()) : '');
document.addEventListener('keydown', (event) => event.key == 'F1' && !event.ctrlKey ? showHint(getSelectedText ()) : '');
document.addEventListener('keydown', (event) => event.key == 'Escape' ? $hint.style.display = 'none' : '');

function showHint(word, stick) {
	if (!word)
		return;
	
	getWord(word, function (err, data) {
		if (err)
			return console.log(err);
		
		$input.value = data.word;
		$transcription.innerHTML = data.transcription || '';
		$inflection.innerHTML = data.inflection || '';
		$suggestions.innerHTML = data.suggestions ? data.suggestions.map((s) => '<li>' + s + '</li>').join('') : '';
		Array.prototype.forEach.call($suggestions.querySelectorAll('li') || [], ($e) => $e.onclick = () => showHint($e.textContent, true));
		$url.href = data.url;
		
		var state = data.means.length > 5 ? '' : 'open';
		$means.innerHTML = data.means.map(function (mean) {
			return '<details ' + state + '><summary><span class = "mean ' + mean.pos + '" >' + mean.mean + '</span> <span class = "pos">' + mean.pos + '</span>' +
			((mean.transcription != data.transcription) ? '<span class = "transcription">' + mean.transcription + '</span>' : '')+ '</summary>' +
			mean.descriptions.map((desc) => '<div class = "description" title = "' + desc.examples.join('\n\n') + '">' + desc.description + '</div>').join('') + 
			'</details>';
		}).join('\n');
		
		var time = 0;
		$hint.oncontextmenu = (event) => event.preventDefault();
		$hint.onmousedown = (event) => event.which == 3 ? (time = new Date().getTime()) : '';
		$hint.onmouseup = (event) => event.which == 3 ? playUrls(new Date().getTime() - time < 300 ? [data.audio[0]] : data.audio) : '';

		$means.style.maxHeight = 'initial';
		$hint.style.display = 'block';
			
		var x = !stick ? mouseX - 5 : parseInt($hint.style.left);
		if (x + $hint.clientWidth > window.innerWidth)
			x = window.innerWidth - $hint.clientWidth - 10;
		$hint.style.left = x + 'px';
	
		var y = !stick ? mouseY - 5 : parseInt($hint.style.top);
		if (y + $hint.clientHeight > window.innerHeight)
			y = window.innerHeight - $hint.clientHeight - 5;
		$hint.style.top = y + 'px';

		$means.style.maxHeight = $means.clientHeight;
		
		playUrl(data.audio[0]);
	});
}

var words = {};

function getWord(word, callback) {
	var data = words[word];
	if (data) 
		return callback(null, data);

	function onload (response) {
		var $html = document.createElement('html');
		$html.innerHTML = response.responseText;

		if (response.responseText.indexOf('Popular searches') != -1) {
			return GM.xmlHttpRequest({
				method: 'GET', 
				url: 'https://dictionary.cambridge.org/search/english/direct/?q=' + encodeURI(word.toLowerCase().replace(/ /g, '-')), 
				onload
			});
		}

		if (response.responseText.indexOf('Search suggestions for') != -1) {
			var data = {
				word,
				transcription: 'Not found. Try one of the below.',
				suggestions: Array.prototype.map.call($html.querySelectorAll('.contain ol.prefix-block li .prefix-item'), ($e) => $e.textContent),
				means: []
			}
			return callback(null, data); 
		}

		var finded = ($html.querySelector('.entry-body .pos-header .headword .hw') || {textContent: word}).textContent;	
		var $block = $html.querySelectorAll('.page [id^=dataset] .entry-body .sense-block');
		
		var means = Array.prototype.map.call($block && $block.length ? $block : $html.querySelectorAll('#dataset-american-english .entry-body .sense-block') || [], function ($e) {
			try {
				var $header = $e.closest('.js-share-holder').querySelector('.pos-header');
				if (!$header)
					return false;

				var mean = ($e.querySelector('.txt-block .guideword span') || {}).textContent || word;

				var descriptions = Array.prototype.map.call($e.querySelectorAll('.def-block.pad-indent') || [], function ($e) {
					var d = ($e.querySelector('.def-head .def') || {}).textContent.trim();
					if (d[d.length - 1] == ':')
						d = d.slice(0, -1);
					return {
						description: d,
						examples: Array.prototype.map.call($e.querySelectorAll('.examp .eg') || [], ($e) => $e.textContent.replace(/\"/g, ''))
					}
				});
							
				return {
					mean,
					transcription: Array.prototype.map.call($header.querySelectorAll('.pron .ipa') || [], ($e) => $e.textContent).filter((e, i, arr) => arr.indexOf(e) == i).join(', '),
					inflection: ($header.querySelector('.irreg-infls') || {}).innerHTML || '',
					pos: ($header.querySelector('.txt-block .pos') || $header.querySelector('.pos')).textContent.trim(),
					descriptions
				}
			} catch(err) {
				console.log(err)
				return false;
			}			
		}).filter((e) => !!e);

		var data = {
			word: finded, 
			means, 
			audio: Array.prototype.map.call($html.querySelectorAll('.audio_play_button') || [], ($e) => $e.getAttribute('data-src-mp3')).filter((e, i, arr) => arr.indexOf(e) == i), 
			transcription: means.map((m) => m.transcription).filter((e, i, arr) => arr.indexOf(e) == i).join(', '), 
			inflection: means.map((m) => m.inflection).filter((e, i, arr) => arr.indexOf(e) == i && !!e).join('; '),
			version,
			url: response.finalUrl
		};

		if (data.means.length > 0) {
			GM.setValue(word, JSON.stringify(data)).then(() => '');
			words[word] = data;
	
			console.log('Load: ', word);
		}
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
				url: 'https://dictionary.cambridge.org/dictionary/english/' + encodeURI(word.toLowerCase().replace(/ /g, '-')), 
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

function playUrls(audio) {
	function playOne(i) {
		if (i == audio.length)
			return false;
	
		playUrl(audio[i]);
		setTimeout(playOne, 1000, i + 1);
	}
	
	playOne(0);
}

document.addEventListener('play-word-audio', function (event) {
	var data = JSON.parse(event.detail);
	if (!data.ctrlKey && data.word)
		getWord(data.word, (err, data) => !err ? playUrl(data && data.audio && data.audio[0]) : '');
}, false);

})(window);