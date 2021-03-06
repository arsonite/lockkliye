import React, { Component } from 'react';

import ContextMenu from './ContextMenu';

class ContextWrapper extends Component {
	state = {
		context: {
			active: false,
			pos: {
				x: 0,
				y: 0
			},
			modifier: {
				index: null,
				option: null
			},
			config: {}
		}
	};

	constructor(props) {
		super(props);

		this.ref = React.createRef();
	}

	componentDidMount = () => {
		this.ref.current.parentNode.addEventListener('contextmenu', event => {
			let context = this.state.context;
			context.pos = { x: event.pageX, y: event.pageY };
			context.active = true;
			this.setState({ context: context });
		});
	};

	/**
	 *
	 */
	static Context = (type, option, flag = '') => {
		return {
			type: type,
			option: option,
			flag: flag
		};
	};

	/**
	 *
	 */
	static ContextList = (label, list) => {
		list.unshift(this.Context('label', label));
		return list;
	};

	render() {
		return (
			<div id='contextWrapper' ref={this.ref}>
				{this.state.context.active ? (
					<ContextMenu
						context={this.state.context}
						collapse={() => {
							let context = this.state.context;
							context.active = false;
							this.setState({ context: context });
						}}
						config={this.props.config}
						popModifier={this.props.popModifier}
					></ContextMenu>
				) : (
					''
				)}
			</div>
		);
	}
}

export default ContextWrapper;
