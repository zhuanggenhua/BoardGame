function onload()
    xpos = -1.65

    self.setName('Betrayal Dice Calculator')
    self.setColorTint({ (56.0/255.0), (64.0/255.0), (72.0/255.0) })

    --Button 0. Displays Total Result. Left.
    self.createButton({ click_function = 'test',
        label = '',
        function_owner = self,
        position = {-2.3, 0.10, 0},
        rotation = {0, 0, 0},
        width = 750,
        height = 750,
        font_size = 500 }
    )
    
    -- Buttons 1 thru 8. Rolls Dice. Bottom Row.
    rollButtons = {}
    for i=1, 8 do
        self.createButton({ click_function = 'roll' .. i,
            label = tostring(i),
            function_owner = self,
            position = {xpos + i * 0.5, 0.10, 0.55},
            rotation = {0, 0, 0},
            width = 200,
            height = 200,
            font_size = 100,
            num = i }
        )
    end

    -- Buttons 9 thru 16. Rerolls Single Die. Top Row.
    rerollButtons = {}
    for i = 9, 16 do
        self.createButton({ click_function = 'reroll' .. i,
            label = 'S',
            function_owner = self,
            position = {xpos + (i - 8) * 0.5, 0.10, -0.55},
            rotation = {0, 0, 0},
            width = 200,
            height = 200,
            font_size = 100,
            num = i }
        )
    end


    -- Buttons 17 thru 24. Displays Individual Results. Middle Row.
    resultButtons = {}
    for i = 17, 24 do
        self.createButton({ click_function = 'test',
            label = '',
            function_owner = self,
            position = {xpos + (i - 16) * 0.5, 0.10, 0},
            rotation = {0, 0, 0},
            width = 250,
            height = 250,
            font_size = 150,
            num = i }
        )
    end

    -- Button 25. Resets Roller. Right.
    self.createButton({ click_function = 'reset',
        label = 'Reset',
        function_owner = self,
        position = {3, 0.10, 0},
        rotation = {0, 270, 0},
        width = 750,
        height = 250,
        font_size = 200 }
    )

    --spawnObject({ type = 'Counter'})
    
    --buttonList = self.getButtons()

    
end

function test()
    --print('test')
end

--------------------

function roll1()
    reset()
    for i = 1+16, 1+16 do
        rollSingle(i)
    end
end

function roll2()
    reset()
    for i = 1+16, 2+16 do
        rollSingle(i)
    end
end

function roll3()
    reset()
    for i = 1+16, 3+16 do
        rollSingle(i)
    end
end

function roll4()
    reset()
    for i = 1+16, 4+16 do
        rollSingle(i)
    end
end

function roll5()
    reset()
    for i = 1+16, 5+16 do
        rollSingle(i)
    end
end

function roll6()
    reset()
    for i = 1+16, 6+16 do
        rollSingle(i)
    end
end

function roll7()
    reset()
    for i = 1+16, 7+16 do
        rollSingle(i)
    end
end

function roll8()
    reset()
    for i = 1+16, 8+16 do
        rollSingle(i)
    end
end

--------------------

function reroll9()
    rollSingle(9 + 8)
end

function reroll10()
    rollSingle(10 + 8)
end

function reroll11()
    rollSingle(11 + 8)
end

function reroll12()
    rollSingle(12 + 8)
end

function reroll13()
    rollSingle(13 + 8)
end

function reroll14()
    rollSingle(14 + 8)
end

function reroll15()
    rollSingle(15 + 8)
end

function reroll16()
    rollSingle(16 + 8)
end

--------------------

function rollSingle(buttonIndex)
    self.editButton({ index = buttonIndex,
        label = math.random(0,2) }
    )
    addDice()
end

--------------------

function addDice()
    buttonList = self.getButtons()
    total = 0
    for i = 18, 25 do
        if buttonList[i].label ~= '' then
            total = total + buttonList[i].label
        end
    end

    self.editButton({ index = 0,
        label = total }
    )

end

--------------------

function reset()
    self.editButton({ index = 0,
        label = '' }
    )

    for i = 17, 24 do
        self.editButton({ index = i,
            label = ''}
        )
    end
end