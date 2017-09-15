/**
 * External dependencies
 */
import { expect } from 'chai';
import { shallow } from 'enzyme';
import React from 'react';
import { spy } from 'sinon';

/**
 * Internal dependencies
 */
import Button from 'components/button';
import RemoveButton from '../index';

// todo these are failing because RemoveButton is wrapped in localize()

describe( 'Remove Button', function() {
	it( 'should render the button if a remove callback is provided', () => {
		const onRemove = () => {
			console.log('called');  // todo tmp
		};

		const wrapper = shallow( <RemoveButton onRemove={ onRemove } /> );

		 console.log( wrapper.html() );
		// console.log( wrapper.debug() );

		expect( wrapper ).to.have.className( 'remove-button' );
		expect( wrapper.find( '.remove-button' ).length ).to.equal( 1 );
	} );

	/*
	it( 'should return early if no callback provided', () => {
		const removeButton = shallow( <RemoveButton /> );
		// todo probably not working, need to get above working first, then copy here and modify

		assert.lengthOf( removeButton.find( '.remove-button' ), 0 );
	} );
	*/

	it( 'should call the provided callback', () => {
		const onRemove = spy();
		const wrapper = shallow( <RemoveButton onRemove={ onRemove } /> );

		wrapper.find( Button ).simulate( 'click' );
		expect( onRemove.calledOnce ).to.equal( true );
	} );
} );
