import React, { Component } from "react";

import ToolBar from "./toolBar";

import "./style/display.css";

class Display extends Component {
  state = {
    oldText: "",
    newText: "",
    dirtyFlag: false
  };

  word = string => {
    let p = document.createElement("p");
    p.id = string;
    p.className = "word";
    p.innerHTML = string;
    return p;
  };

  reset = text => {
    this.setState({ dirtyFlag: true }, () => {
      text = text.replace(/<p.+?>/g, "");
      text = text.replace(/<\/p>/g, "");

      this.setState({ oldText: text }, () => {
        this.setState({ dirtyFlag: false });
      });
    });
  };

  filter = text => {
    this.setState({ dirtyFlag: true }, () => {
      text = text.replace(/<br>/g, "");
      text = text.replace(/<div>/g, "§");
      text = text.replace(/<\/div>/g, "");
      text = text.replace(/&nbsp;/g, " ");

      this.setState({ newText: text }, () => {
        this.setState({ dirtyFlag: false });
      });
    });
  };

  package = text => {
    if (this.state.oldText === this.state.newText) return text;

    text = text.split(/[\s§]/g);
    let packagedText = document.createElement("div");

    for (let string of text) {
      if (string === "§") {
        packagedText.innerHTML += "\n";
        continue;
      }

      packagedText.appendChild(this.word(string));
    }
    return packagedText.innerHTML;
  };

  render() {
    if (this.state.dirtyFlag) return null;
    return (
      <div id='display' className='screen'>
        <ToolBar />
        <main
          contentEditable='true'
          onFocus={e => this.reset(e.target.innerHTML)}
          onInput={e => this.filter(e.target.innerHTML)}
          onBlur={e => {
            e.target.innerHTML = this.package(e.target.innerHTML);
          }}
        />
      </div>
    );
  }
}

export default Display;
