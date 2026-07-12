function onLoad()
    self.interactable = false;
    self.createButton({
    label = "CUSTOMIZE BOARD",
    click_function = "onButtonClick",
    function_owner = self,
    width = 750,
    height = 75,
    color = {1, 1, 1, 1.0},
    position = {-15.5, 10, -5},
    rotation = {180, 270, 80},
    font_size = 75
})
end

function onButtonClick()
    if self.interactable == false then
        self.interactable = true;
        self.setColorTint({1, 1, 1})
        self.editButton({ label = "LOCK BOARD" })

    else
        self.interactable = false;
        self.editButton({ label = "CUSTOMIZE BOARD"})

    end
end