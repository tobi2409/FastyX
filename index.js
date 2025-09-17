const t = document.createElement('test-component')
document.querySelector('body').appendChild(t)

document.querySelector('body').innerHTML += `<div data-grid="true" style="width=\"100px\" height=\"100px\"">
                                                <div data-align="bottom" style="background-color=\"yellow\""></div>
                                            </div>`