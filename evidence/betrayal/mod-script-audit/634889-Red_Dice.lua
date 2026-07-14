function onLoad(save_state)
  local button = {index = 0, click_function = 'returnDice', function_owner = self,
  label = 'Return Dice', position = {x = 0, y = 1, z = 0}, rotation = {x = 0, y = 0, z = 0},
  scale = {x = 0.5, y = 1, z = 0.5}, width = 2100, height = 400, font_size = 400,
  font_color = {r = 0, g = 0, b = 0, a = 1}}

  button.color = self.getColorTint()
  self.createButton(button)
end

local dice = {
  '145a04',
  '383b23',
  '11edda',
  '03a6f4',
  'f5780c',
  'eb6eb0',
  'da2a96',
  'bd6931'
}

function returnDice()
  local xP = {
    [1] = self.getPosition().x - 1.5,
    [2] = self.getPosition().x - 0.5,
    [3] = self.getPosition().x + 0.5,
    [4] = self.getPosition().x + 1.5
  }
  local zP = {
    [1] = self.getPosition().z - 1,
    [2] = self.getPosition().z - 2
  }

  local i = 1
  local j = 1
  for _,guid in pairs(dice) do
    local xPos = xP[i]
    local zPos = zP[j]

    local obj = getObjectFromGUID(guid)
    obj.setRotation({0,0,0})
    obj.setPosition({xPos, 1.5, zPos})

    i = i + 1
    if i > 4 then
      j = 2
      i = 1
    end
  end
end