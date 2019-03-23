import React, { Component } from 'react';

import ToolBar from './toolBar';

import './style/display.css';

const FLAG_NL = '';
const FLAG_S = '';

class Display extends Component {
  word = string => {
    let p = document.createElement('p');
    p.className = 'word';
    p.innerHTML = string;
    return p;
  };

  package = text => {
    text = text.replace(/<p.+?>/g, '');
    text = text.replace(/<\/p>/g, '');
    text = text.replace(/<br>/g, '');
    text = text.replace(/<div>/g, '§');
    text = text.replace(/<\/div>/g, '');
    text = text.replace(/&nbsp;/g, ' ');

    text = text.split(/[\s§]/g);
    console.log(text);
    let packagedText = document.createElement('div');

    for (let string of text) {
      if (string === '§') {
        packagedText.innerHTML += '\n';
        continue;
      }

      packagedText.appendChild(this.word(string));
    }
    return packagedText.innerHTML;
  };

  render() {
    return (
      <div id='display' className='screen'>
        <ToolBar />
        <main
          contentEditable='true'
          onBlur={e => {
            e.target.innerHTML = this.package(e.target.innerHTML);
          }}
        />
      </div>
    );
  }
}

export default Display;
