import React, { useState } from 'react';
import HomePage from '../components/HomePage/HomePage';
import NavBar from '../components/NavMenu/NavBar'


function MyHomePage () {
    return ( 
        <>
        <NavBar></NavBar>
        <HomePage></HomePage>
        </>
     );
}

export default MyHomePage;